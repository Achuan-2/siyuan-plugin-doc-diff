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
import { generateFullDiffHtml, generateSwappableDiffHtml, generateModeSwitchableDiffHtml, computeTextDiff, DiffViewMode } from "./utils/diffUtils";

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
        let currentMode = DiffViewMode.UNIFIED; // 默认使用合并模式
        let dialog: Dialog;
        
        // 保存原始内容用于撤回
        const originalDoc1Content = doc1.content;
        const originalDoc2Content = doc2.content;
        
        // 保存当前的差异结果用于行级操作
        let currentDiffResult: any = null;
        
        const updateDiffContent = () => {
            // 计算并保存当前的差异结果
            currentDiffResult = computeTextDiff(currentDoc1.content, currentDoc2.content);
            
            const diffHtml = generateModeSwitchableDiffHtml(
                currentDoc1,
                currentDoc2,
                currentMode,
                {
                    swapCallback: 'swapDocuments()',
                    revertCallback: 'revertChanges()',
                    saveCallback: 'saveChanges()',
                    modeChangeCallback: 'switchDiffMode'
                }
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
        
        const switchDiffMode = (newMode: string) => {
            currentMode = newMode as DiffViewMode;
            updateDiffContent();
        };
        
        const saveChanges = async () => {
            try {
                if (currentMode !== DiffViewMode.SIDE_BY_SIDE) {
                    pushErrMsg(t("docDiff.saveOnlyInSideBySide"));
                    return;
                }
                
                // 获取右侧编辑区域的内容
                const rightPaneContent = dialog.element.querySelector('#right-pane-content');
                if (!rightPaneContent) {
                    pushErrMsg(t("docDiff.cannotFindEditArea"));
                    return;
                }
                
                // 提取文本内容
                let newContent = '';
                const sideLines = rightPaneContent.querySelectorAll('.side-line');
                const lines: string[] = [];
                
                sideLines.forEach((sideLine) => {
                    const contentElement = sideLine.querySelector('.side-line-content');
                    if (contentElement) {
                        // 获取纯文本内容，移除HTML标签
                        let lineText = contentElement.textContent || '';
                        // 处理空行
                        if (lineText === '\u00A0' || lineText.trim() === '') {
                            lineText = '';
                        }
                        lines.push(lineText);
                    }
                });
                
                newContent = lines.join('\n');
                
                // 使用 confirm 函数显示确认对话框
                confirm(
                    t("docDiff.saveChanges"),
                    t("docDiff.confirmSave"),
                    async () => {
                        try {
                            // 更新文档内容
                            const targetDocId = currentDoc2.id;
                            await updateBlock("markdown", newContent, targetDocId);
                            
                            showMessage(t("docDiff.saveSuccess"));
                            
                            // 更新当前文档内容以反映更改
                            const updatedDocInfo = await this.getDocumentInfo(targetDocId, 'markdown');
                            currentDoc2 = updatedDocInfo;
                            updateDiffContent();
                        } catch (error) {
                            console.error("保存文档失败:", error);
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            pushErrMsg(`${t("docDiff.saveError")}: ${errorMessage}`);
                        }
                    }
                );
            } catch (error) {
                console.error("保存操作失败:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                pushErrMsg(`${t("docDiff.saveOperationFailed")}: ${errorMessage}`);
            }
        };
        
        const revertLine = async (lineIndex: number, lineType: string) => {
            try {
                if (!currentDiffResult || !currentDiffResult.lines[lineIndex]) {
                    pushErrMsg("无法找到指定的差异行");
                    return;
                }
                
                const diffLine = currentDiffResult.lines[lineIndex];
                // 新文档始终是右侧文档（currentDoc2），这是我们要修改的目标文档
                const newDocId = currentDoc2.id;
                // 旧文档始终是左侧文档（currentDoc1），这是我们要恢复到的原始内容
                const oldDocContent = currentDoc1.content;
                
                if (lineType === 'added' && diffLine.newLineNumber && diffLine.oldLineNumber) {
                    // 撤回修改行：将新文档的该行替换为旧文档的对应行内容
                    const oldLines = oldDocContent.split('\n');
                    const oldLineIndex = diffLine.oldLineNumber - 1;
                    
                    if (oldLineIndex >= 0 && oldLineIndex < oldLines.length) {
                        // 获取新文档当前内容
                        const newDocCurrentContent = (await exportMdContent(newDocId)).content;
                        const newLines = newDocCurrentContent.split('\n');
                        const newLineIndex = diffLine.newLineNumber - 1;
                        
                        if (newLineIndex >= 0 && newLineIndex < newLines.length) {
                            // 将新文档的当前行替换为旧文档的对应行
                            newLines[newLineIndex] = oldLines[oldLineIndex];
                            const updatedContent = newLines.join('\n');
                            await updateBlock("markdown", updatedContent, newDocId);
                            showMessage("已撤回到原文档内容");
                            
                            // 刷新差异视图 - 更新新文档（右侧文档）
                            const updatedDocInfo = await this.getDocumentInfo(newDocId, 'markdown');
                            currentDoc2 = updatedDocInfo;
                            updateDiffContent();
                        }
                    }
                } else if (lineType === 'added' && diffLine.newLineNumber && !diffLine.oldLineNumber) {
                    // 撤回纯新增行：将该行替换为旧文档中对应位置的行内容
                    const oldLines = oldDocContent.split('\n');
                    const newDocCurrentContent = (await exportMdContent(newDocId)).content;
                    const newLines = newDocCurrentContent.split('\n');
                    const newLineIndex = diffLine.newLineNumber - 1;
                    
                    if (newLineIndex >= 0 && newLineIndex < newLines.length) {
                        // 通过分析差异结果来找到更准确的对应位置
                        let correspondingOldLineIndex = -1;
                        
                        // 向前查找最近的有oldLineNumber的行
                        for (let i = lineIndex - 1; i >= 0; i--) {
                            const prevLine = currentDiffResult.lines[i];
                            if (prevLine.oldLineNumber) {
                                correspondingOldLineIndex = prevLine.oldLineNumber - 1;
                                break;
                            }
                        }
                        
                        // 如果没有找到前面的参考行，向后查找
                        if (correspondingOldLineIndex === -1) {
                            for (let i = lineIndex + 1; i < currentDiffResult.lines.length; i++) {
                                const nextLine = currentDiffResult.lines[i];
                                if (nextLine.oldLineNumber) {
                                    // 使用前一行作为对应位置
                                    correspondingOldLineIndex = Math.max(0, nextLine.oldLineNumber - 2);
                                    break;
                                }
                            }
                        }
                        
                        // 如果还是没找到，使用简单的位置映射
                        if (correspondingOldLineIndex === -1) {
                            correspondingOldLineIndex = Math.min(newLineIndex, oldLines.length - 1);
                        }
                        
                        // 确保索引在有效范围内
                        correspondingOldLineIndex = Math.max(0, Math.min(correspondingOldLineIndex, oldLines.length - 1));
                        
                        // 获取旧文档对应位置的内容
                        const oldLineContent = correspondingOldLineIndex < oldLines.length
                            ? oldLines[correspondingOldLineIndex]
                            : '';
                        
                        // 将新增行替换为旧文档对应位置的内容
                        newLines[newLineIndex] = oldLineContent;
                        const updatedContent = newLines.join('\n');
                        await updateBlock("markdown", updatedContent, newDocId);
                        showMessage("已撤回到原文档对应位置的内容");
                        
                        // 刷新差异视图 - 更新新文档（右侧文档）
                        const updatedDocInfo = await this.getDocumentInfo(newDocId, 'markdown');
                        currentDoc2 = updatedDocInfo;
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
        (window as any).switchDiffMode = switchDiffMode;
        (window as any).saveChanges = saveChanges;
        
        // 初始化差异结果
        currentDiffResult = computeTextDiff(currentDoc1.content, currentDoc2.content);
        
        const initialDiffHtml = generateModeSwitchableDiffHtml(
            currentDoc1,
            currentDoc2,
            currentMode,
            {
                swapCallback: 'swapDocuments()',
                revertCallback: 'revertChanges()',
                saveCallback: 'saveChanges()',
                modeChangeCallback: 'switchDiffMode'
            }
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
                delete (window as any).switchDiffMode;
                delete (window as any).saveChanges;
            }
        });
    }
}
