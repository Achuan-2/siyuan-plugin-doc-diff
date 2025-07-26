import {
    Plugin,
    showMessage,
    confirm,
    Dialog,
    Menu,
    openTab,
    adaptHotkey,
    getFrontend,
    getBackend,
    Protyle,
    openWindow,
    IOperation,
    Constants,
    openMobileFileById,
    lockScreen,
    ICard,
    ICardData
} from "siyuan";

import { appendBlock, deleteBlock, setBlockAttrs, getBlockAttrs, pushMsg, pushErrMsg, sql, renderSprig, getChildBlocks, insertBlock, renameDocByID, prependBlock, updateBlock, createDocWithMd,  getBlockKramdown, getBlockDOM, getBlockByID, exportMdContent } from "./api";
import "@/index.scss";

import SettingPanel from "./setting-example.svelte";
import { getDefaultSettings } from "./defaultSettings";
import { setPluginInstance, t } from "./utils/i18n";
import LoadingDialog from "./components/LoadingDialog.svelte";
import { generateFullDiffHtml, generateSwappableDiffHtml } from "./utils/diffUtils";

export const SETTINGS_FILE = "settings.json";



export default class PluginSample extends Plugin {
    private selectedDocuments: string[] = [];

    async onload() {
        // 插件被启用时会自动调用这个函数
        // 设置i18n插件实例
        setPluginInstance(this);

        // 加载设置
        await this.loadSettings();

        // 监听文档树菜单事件
        this.eventBus.on("open-menu-doctree", this.handleDocTreeMenu.bind(this));
    }

    async onLayoutReady() {
        //布局加载完成的时候，会自动调用这个函数

    }

    async onunload() {
        //当插件被禁用的时候，会自动调用这个函数
        console.log("onunload");
    }

    uninstall() {
        //当插件被卸载的时候，会自动调用这个函数
        console.log("uninstall");
    }

    /**
     * 打开设置对话框
     */
    // 重写 openSetting 方法
    async openSetting() {
        let dialog = new Dialog({
            title: t("settings.settingsPanel"),
            content: `<div id="SettingPanel" style="height: 100%;"></div>`,
            width: "800px",
            height: "700px",
            destroyCallback: () => {
                pannel.$destroy();
            }
        });

        let pannel = new SettingPanel({
            target: dialog.element.querySelector("#SettingPanel"),
            props: {
                plugin: this
            }
        });
    }
    /**
     * 加载设置
     */
    async loadSettings() {
        const settings = await this.loadData(SETTINGS_FILE);
        const defaultSettings = getDefaultSettings();
        return { ...defaultSettings, ...settings };
    }

    /**
     * 保存设置
     */
    async saveSettings(settings: any) {
        await this.saveData(SETTINGS_FILE, settings);
    }

    /**
     * 处理文档树菜单事件
     */
    private async handleDocTreeMenu({detail}: any) {
        
        // 检查detail和elements是否存在
        if (!detail.elements || detail.elements.length < 2) {
            return;
        }
        console.log("Handling document tree menu event:", detail.elements);
        // 将NodeList转换为数组，然后获取选中的文档元素
        const selectedElements = Array.from(detail.elements).filter((element: any) =>
            element && element.getAttribute && element.getAttribute("data-type") === "navigation-file"
        );
        console.log("Selected elements:", selectedElements);
        // 只有选中两个文档时才显示差异比较选项
        if (selectedElements.length === 2) {
            console.log("Selected documents for comparison:", selectedElements);
            const docIds = selectedElements.map((element: any) =>
                element.getAttribute("data-node-id")
            ).filter(id => id); // 过滤掉空的ID
            
            // 确保我们有两个有效的文档ID
            if (docIds.length === 2) {
                this.selectedDocuments = docIds;

                // 添加 Markdown 格式比较菜单项
                detail.menu.addItem({
                    icon: "iconSort",
                    label: t("docDiff.compareDocumentsMarkdown"),
                    click: () => {
                        this.compareDocuments(docIds[0], docIds[1], 'markdown');
                    }
                });

                // 添加 Kramdown 格式比较菜单项
                detail.menu.addItem({
                    icon: "iconSort",
                    label: t("docDiff.compareDocumentsKramdown"),
                    click: () => {
                        this.compareDocuments(docIds[0], docIds[1], 'kramdown');
                    }
                });
            }
        }
    }

    /**
     * 比较两个文档
     */
    private async compareDocuments(docId1: string, docId2: string, format: 'markdown' | 'kramdown' = 'markdown') {
        if (!docId1 || !docId2) {
            pushErrMsg(t("docDiff.error") + ": " + t("docDiff.invalidDocId"));
            return;
        }

        let loadingDialog: Dialog | null = null;
        
        try {
            // 显示加载对话框
            loadingDialog = new Dialog({
                title: t("docDiff.loading"),
                content: `<div class="b3-dialog__content">
                    <div class="fn__loading">
                        <img width="120px" src="/stage/loading-pure.svg">
                    </div>
                    <div class="ft__center">${t("docDiff.loadingContent")}</div>
                </div>`,
                width: "400px",
                height: "200px"
            });

            // 获取两个文档的信息
            const [doc1Info, doc2Info] = await Promise.all([
                this.getDocumentInfo(docId1, format),
                this.getDocumentInfo(docId2, format)
            ]);

            if (loadingDialog) {
                loadingDialog.destroy();
                loadingDialog = null;
            }

            // 检查文档信息是否有效
            if (!doc1Info || !doc2Info) {
                pushErrMsg(t("docDiff.error") + ": " + t("docDiff.cannotGetDocInfo"));
                return;
            }

            // 创建差异比较对话框
            this.showDiffDialog(doc1Info, doc2Info);

        } catch (error) {
            if (loadingDialog) {
                loadingDialog.destroy();
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            pushErrMsg(`${t("docDiff.error")}: ${errorMessage}`);
        }
    }

    /**
     * 获取文档信息（标题和内容）
     */
    private async getDocumentInfo(docId: string, format: 'markdown' | 'kramdown' = 'markdown') {
        try {
            const titleResult = await getBlockByID(docId);
            let contentResult;

            // 根据格式参数获取不同的内容
            if (format === 'kramdown') {
                contentResult = await getBlockKramdown(docId);
            } else {
                contentResult = await exportMdContent(docId);
            }

            // 检查返回结果是否有效
            if (!titleResult || !contentResult) {
                throw new Error(`${t("docDiff.cannotGetDocInfo")} ${docId}`);
            }

            return {
                id: docId,
                title: titleResult.content || `文档 ${docId}`,
                content: format === 'kramdown' ? contentResult.kramdown || '' : contentResult.content || ''
            };
        } catch (error) {
            console.error(`${t("docDiff.getDocInfoFailed")} (${docId}):`, error);
            throw new Error(`${t("docDiff.getDocInfoFailed")}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 显示差异比较对话框
     */
    private showDiffDialog(doc1: any, doc2: any) {
        let isSwapped = false;
        let currentDoc1 = doc1;
        let currentDoc2 = doc2;
        let dialog: Dialog;
        
        const updateDiffContent = () => {
            const diffHtml = generateSwappableDiffHtml(currentDoc1, currentDoc2, 'swapDocuments()', t("docDiff.swapDocumentsTooltip"));
            const container = dialog.element.querySelector('.doc-diff-container');
            if (container) {
                container.innerHTML = diffHtml;
            }
        };
        
        const swapDocuments = () => {
            // 交换文档
            const temp = currentDoc1;
            currentDoc1 = currentDoc2;
            currentDoc2 = temp;
            isSwapped = !isSwapped;
            
            // 更新差异内容
            updateDiffContent();
        };
        
        // 将交换函数暴露到全局，以便HTML中的按钮可以调用
        (window as any).swapDocuments = swapDocuments;
        
        const initialDiffHtml = generateSwappableDiffHtml(currentDoc1, currentDoc2, 'swapDocuments()', t("docDiff.swapDocumentsTooltip"));
        
        dialog = new Dialog({
            title: t("docDiff.diffTitle"),
            content: `<div class="doc-diff-container" style="height: 100%; overflow: auto;">
                ${initialDiffHtml}
            </div>`,
            width: "90vw",
            height: "80vh",
            destroyCallback: () => {
                // 清理全局函数
                delete (window as any).swapDocuments;
            }
        });
    }
}
