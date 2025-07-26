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
import { generateFullDiffHtml, generateSwappableDiffHtml, computeTextDiff } from "./utils/diffUtils";

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
        
        // 保存原始内容用于撤回
        const originalDoc1Content = doc1.content;
        const originalDoc2Content = doc2.content;
        
        // 保存当前的差异结果用于行级操作
        let currentDiffResult: any = null;
        
        const updateDiffContent = () => {
            // 计算并保存当前的差异结果
            currentDiffResult = computeTextDiff(currentDoc1.content, currentDoc2.content);
            
            const diffHtml = generateSwappableDiffHtml(
                currentDoc1,
                currentDoc2,
                'swapDocuments()',
                t("docDiff.swapDocumentsTooltip"),
                'revertChanges()'
            );
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
        
        const revertChanges = async () => {
            try {
                // 使用 confirm 函数显示确认对话框
                confirm(
                    t("docDiff.revertChanges"),
                    t("docDiff.confirmRevert"),
                    async () => {
                        try {
                            // 将新文档内容撤回为旧文档内容
                            // 新文档是右侧文档（currentDoc2），旧文档是左侧文档（currentDoc1）
                            const newDocId = currentDoc2.id;
                            const oldDocContent = currentDoc1.content;
                            
                            // 使用 updateBlock API 将新文档内容更新为旧文档内容
                            await updateBlock("markdown", oldDocContent, newDocId);
                            
                            showMessage(t("docDiff.revertSuccess"));
                            
                            // 关闭对话框
                            dialog.destroy();
                        } catch (error) {
                            console.error("撤回更改失败:", error);
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            pushErrMsg(`${t("docDiff.revertError")}: ${errorMessage}`);
                        }
                    }
                );
            } catch (error) {
                console.error("显示确认对话框失败:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                pushErrMsg(`${t("docDiff.revertError")}: ${errorMessage}`);
            }
        };
        
        
        const revertLine = async (lineIndex: number, lineType: string) => {
            try {
                if (!currentDiffResult || !currentDiffResult.lines[lineIndex]) {
                    pushErrMsg("无法找到指定的差异行");
                    return;
                }
                
                const diffLine = currentDiffResult.lines[lineIndex];
                const targetDocId = isSwapped ? currentDoc2.id : currentDoc1.id;
                
                if (lineType === 'added' && diffLine.newLineNumber && diffLine.oldLineNumber) {
                    // 撤回新增行：将其替换为原文档的对应行内容
                    // 需要找到原文档中对应位置的内容
                    const originalContent = isSwapped ? originalDoc2Content : originalDoc1Content;
                    const originalLines = originalContent.split('\n');
                    const originalLineIndex = diffLine.oldLineNumber - 1;
                    
                    if (originalLineIndex >= 0 && originalLineIndex < originalLines.length) {
                        // 获取当前文档内容
                        const currentContent = (await exportMdContent(targetDocId)).content;
                        const currentLines = currentContent.split('\n');
                        const currentLineIndex = diffLine.newLineNumber - 1;
                        
                        if (currentLineIndex >= 0 && currentLineIndex < currentLines.length) {
                            // 将当前行替换为原文档的对应行
                            currentLines[currentLineIndex] = originalLines[originalLineIndex];
                            const newContent = currentLines.join('\n');
                            await updateBlock("markdown", newContent, targetDocId);
                            showMessage("已撤回到原文档内容");
                            
                            // 刷新差异视图
                            const updatedDocInfo = await this.getDocumentInfo(targetDocId, 'markdown');
                            if (isSwapped) {
                                currentDoc2 = updatedDocInfo;
                            } else {
                                currentDoc1 = updatedDocInfo;
                            }
                            updateDiffContent();
                        }
                    }
                } else if (lineType === 'added' && diffLine.newLineNumber && !diffLine.oldLineNumber) {
                    // 如果是纯新增行（没有对应的原文档行），则删除该行
                    const currentContent = (await exportMdContent(targetDocId)).content;
                    const lines = currentContent.split('\n');
                    const lineNum = diffLine.newLineNumber - 1;
                    
                    if (lineNum >= 0 && lineNum < lines.length) {
                        lines.splice(lineNum, 1);
                        const newContent = lines.join('\n');
                        await updateBlock("markdown", newContent, targetDocId);
                        showMessage("已撤回此行的新增");
                        
                        // 刷新差异视图
                        const updatedDocInfo = await this.getDocumentInfo(targetDocId, 'markdown');
                        if (isSwapped) {
                            currentDoc2 = updatedDocInfo;
                        } else {
                            currentDoc1 = updatedDocInfo;
                        }
                        updateDiffContent();
                    }
                }
            } catch (error) {
                console.error("撤回行失败:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                pushErrMsg(`撤回行失败: ${errorMessage}`);
            }
        };
        
        // applyLine 函数已移除，因为原文档被删除的行不显示接受按钮
        
        // 将函数暴露到全局，以便HTML中的按钮可以调用
        (window as any).swapDocuments = swapDocuments;
        (window as any).revertChanges = revertChanges;
        (window as any).revertLine = revertLine;
        
        // 初始化差异结果
        currentDiffResult = computeTextDiff(currentDoc1.content, currentDoc2.content);
        
        const initialDiffHtml = generateSwappableDiffHtml(
            currentDoc1,
            currentDoc2,
            'swapDocuments()',
            t("docDiff.swapDocumentsTooltip"),
            'revertChanges()'
        );
        
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
                delete (window as any).revertChanges;
                delete (window as any).revertLine;
            }
        });
    }
}
