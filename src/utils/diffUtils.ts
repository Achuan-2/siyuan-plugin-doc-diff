/**
 * 文档差异比较工具类
 * 实现类似GitHub的diff算法
 */

export enum DiffViewMode {
    UNIFIED = 'unified',    // 合并模式（统一diff视图）
    SIDE_BY_SIDE = 'side-by-side'  // 并排模式（两个窗口）
}

export interface DiffLine {
    type: 'added' | 'removed' | 'context';
    oldLineNumber?: number;
    newLineNumber?: number;
    content: string;
    isIdLine?: boolean; // 标记是否为ID行
}

export interface DiffResult {
    lines: DiffLine[];
    stats: {
        additions: number;
        deletions: number;
        changes: number;
    };
}

export interface DiffViewOptions {
    mode: DiffViewMode;
    enableLineActions?: boolean;
    enableEditing?: boolean;  // 是否启用编辑功能（仅在side-by-side模式下有效）
    showLineNumbers?: boolean;
    contextLines?: number;
}

/**
 * 计算两个文本的差异
 * 使用改进的Myers算法
 */
export function computeTextDiff(text1: string, text2: string): DiffResult {
    // 使用增强的文本预处理
    const processedText1 = preprocessText(text1 || '');
    const processedText2 = preprocessText(text2 || '');
    
    const lines1 = processedText1.split('\n').filter((line, index, array) => {
        // 保留所有行，包括空行，但移除最后一个空行（如果它是由我们添加的换行符产生的）
        return index < array.length - 1 || line !== '';
    });
    const lines2 = processedText2.split('\n').filter((line, index, array) => {
        return index < array.length - 1 || line !== '';
    });
    
    const diff = computeLineDiff(lines1, lines2);
    const stats = calculateStats(diff);
    
    return {
        lines: diff,
        stats
    };
}

/**
 * 标准化换行符，将所有换行符统一为 \n
 */
function normalizeLineEndings(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * 增强的文本预处理，处理各种边界情况
 */
function preprocessText(text: string): string {
    if (!text) return '';
    
    // 标准化换行符
    let processed = normalizeLineEndings(text);
    
    // 确保文本以换行符结尾（如果原本不是空的话）
    if (processed.length > 0 && !processed.endsWith('\n')) {
        processed += '\n';
    }
    
    return processed;
}

/**
 * 检测是否为ID行（以{: ...}开头的行）
 */
function isIdLine(content: string): boolean {
    return /^\s*\{:\s+.*}/.test(content.trim());
}

/**
 * 计算行级差异
 */
function computeLineDiff(lines1: string[], lines2: string[]): DiffLine[] {
    const result: DiffLine[] = [];
    const lcs = longestCommonSubsequence(lines1, lines2);
    
    let i = 0, j = 0, k = 0;
    let oldLineNum = 1, newLineNum = 1;
    
    while (i < lines1.length || j < lines2.length) {
        if (k < lcs.length && i < lines1.length && j < lines2.length && lines1[i] === lcs[k] && lines2[j] === lcs[k]) {
            // 相同行
            result.push({
                type: 'context',
                oldLineNumber: oldLineNum,
                newLineNumber: newLineNum,
                content: lines1[i],
                isIdLine: isIdLine(lines1[i])
            });
            i++;
            j++;
            k++;
            oldLineNum++;
            newLineNum++;
        } else if (i < lines1.length && (k >= lcs.length || lines1[i] !== lcs[k])) {
            // 删除的行
            result.push({
                type: 'removed',
                oldLineNumber: oldLineNum,
                content: lines1[i],
                isIdLine: isIdLine(lines1[i])
            });
            i++;
            oldLineNum++;
        } else if (j < lines2.length) {
            // 新增的行
            result.push({
                type: 'added',
                newLineNumber: newLineNum,
                content: lines2[j],
                isIdLine: isIdLine(lines2[j])
            });
            j++;
            newLineNum++;
        }
    }
    
    return optimizeDiffResult(result);
}

/**
 * 优化差异结果，合并相邻的上下文行，提供更好的可读性
 */
function optimizeDiffResult(diff: DiffLine[]): DiffLine[] {
    const optimized: DiffLine[] = [];
    const contextLines = 3; // 显示的上下文行数
    
    for (let i = 0; i < diff.length; i++) {
        const line = diff[i];
        
        if (line.type !== 'context') {
            // 非上下文行直接添加
            optimized.push(line);
        } else {
            // 上下文行需要判断是否应该显示
            const prevNonContext = findPreviousNonContextIndex(diff, i);
            const nextNonContext = findNextNonContextIndex(diff, i);
            
            const shouldShow = (
                (prevNonContext >= 0 && i - prevNonContext <= contextLines) ||
                (nextNonContext >= 0 && nextNonContext - i <= contextLines)
            );
            
            if (shouldShow) {
                optimized.push(line);
            }
        }
    }
    
    return optimized;
}

/**
 * 查找前一个非上下文行的索引
 */
function findPreviousNonContextIndex(diff: DiffLine[], currentIndex: number): number {
    for (let i = currentIndex - 1; i >= 0; i--) {
        if (diff[i].type !== 'context') {
            return i;
        }
    }
    return -1;
}

/**
 * 查找下一个非上下文行的索引
 */
function findNextNonContextIndex(diff: DiffLine[], currentIndex: number): number {
    for (let i = currentIndex + 1; i < diff.length; i++) {
        if (diff[i].type !== 'context') {
            return i;
        }
    }
    return -1;
}

/**
 * 计算最长公共子序列
 */
function longestCommonSubsequence(arr1: string[], arr2: string[]): string[] {
    const m = arr1.length;
    const n = arr2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // 构建DP表
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (arr1[i - 1] === arr2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    // 回溯构建LCS
    const lcs: string[] = [];
    let i = m, j = n;
    
    while (i > 0 && j > 0) {
        if (arr1[i - 1] === arr2[j - 1]) {
            lcs.unshift(arr1[i - 1]);
            i--;
            j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }
    
    return lcs;
}

/**
 * 计算差异统计信息
 */
function calculateStats(diff: DiffLine[]): { additions: number; deletions: number; changes: number } {
    let additions = 0;
    let deletions = 0;
    
    for (const line of diff) {
        if (line.type === 'added') {
            additions++;
        } else if (line.type === 'removed') {
            deletions++;
        }
    }
    
    return {
        additions,
        deletions,
        changes: additions + deletions
    };
}

/**
 * 生成差异HTML（通用函数）
 */
export function generateDiffHtml(doc1: any, doc2: any, options: DiffViewOptions = { mode: DiffViewMode.UNIFIED }): string {
    switch (options.mode) {
        case DiffViewMode.UNIFIED:
            return generateUnifiedDiffHtml(doc1, doc2, options);
        case DiffViewMode.SIDE_BY_SIDE:
            return generateSideBySideDiffHtml(doc1, doc2, options);
        default:
            return generateUnifiedDiffHtml(doc1, doc2, options);
    }
}

/**
 * 生成统一差异HTML（合并模式）
 */
export function generateUnifiedDiffHtml(doc1: any, doc2: any, options: DiffViewOptions): string {
    const diffResult = computeTextDiff(doc1.content, doc2.content);
    const enableLineActions = options.enableLineActions || false;
    
    let diffHtml = '';
    
    // 添加统计信息
    const stats = diffResult.stats;
    diffHtml += `
        <div class="diff-stats">
            <span class="diff-stat-item">
                <span class="diff-stat-additions">+${stats.additions}</span>
                <span class="diff-stat-deletions">-${stats.deletions}</span>
            </span>
        </div>
    `;
    
    // 生成差异行
    for (let i = 0; i < diffResult.lines.length; i++) {
        const line = diffResult.lines[i];
        const oldLineNum = line.oldLineNumber || '';
        const newLineNum = line.newLineNumber || '';
        const content = processLineContent(line.content);
        
        let lineClass = '';
        let prefix = '';
        let actionButtons = '';
        
        switch (line.type) {
            case 'added':
                lineClass = line.isIdLine ? 'diff-line-added diff-line-id' : 'diff-line-added';
                prefix = '<span class="diff-prefix">+</span>';
                if (enableLineActions) {
                    actionButtons = `
                        <div class="diff-line-actions">
                            <button class="diff-line-action-btn diff-revert-line-btn"
                                    onclick="window.revertLine && window.revertLine(${i}, 'added')"
                                    title="撤回到原文档内容">
                                    <svg  viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" fill=“currentColor” width="64" height="64"><path d="M64 347.552L320 128v448z"  p-id="6963"></path><path d="M265.472 896v-112h377.824a200 200 0 1 0 0-400H240V272h403.296c172.32 0 312 139.68 312 312S815.616 896 643.296 896H265.472z"  p-id="6964"></path></svg>
                            </button>
                        </div>
                    `;
                }
                break;
            case 'removed':
                lineClass = line.isIdLine ? 'diff-line-removed diff-line-id' : 'diff-line-removed';
                prefix = '<span class="diff-prefix">-</span>';
                // 原文档被删除的行不显示接受按钮
                break;
            case 'context':
                lineClass = 'diff-line-context';
                prefix = '<span class="diff-prefix">&nbsp;</span>';
                break;
        }
        
        diffHtml += `
            <div class="diff-line ${lineClass}" data-line-index="${i}">
                <div class="diff-line-number old-line-number">${oldLineNum}</div>
                <div class="diff-line-number new-line-number">${newLineNum}</div>
                <div class="diff-line-content">${prefix}${content}</div>
                ${actionButtons}
            </div>
        `;
    }
    
    return diffHtml;
}

/**
 * 生成并排差异HTML（并排模式）
 */
export function generateSideBySideDiffHtml(doc1: any, doc2: any, options: DiffViewOptions): string {
    const diffResult = computeTextDiff(doc1.content, doc2.content);
    const enableEditing = options.enableEditing || false;
    const showLineNumbers = options.showLineNumbers !== false; // 默认显示行号
    
    let diffHtml = '';
    
    // 添加统计信息
    const stats = diffResult.stats;
    diffHtml += `
        <div class="diff-stats">
            <span class="diff-stat-item">
                <span class="diff-stat-additions">+${stats.additions}</span>
                <span class="diff-stat-deletions">-${stats.deletions}</span>
            </span>
        </div>
    `;
    
    // 创建行映射，用于在并排模式中显示差异
    const leftLineMap = new Map<number, { type: 'added' | 'removed' | 'context', content: string, isIdLine?: boolean }>();
    const rightLineMap = new Map<number, { type: 'added' | 'removed' | 'context', content: string, isIdLine?: boolean }>();
    
    // 处理差异结果，建立行映射
    for (const line of diffResult.lines) {
        if (line.oldLineNumber !== undefined) {
            leftLineMap.set(line.oldLineNumber, {
                type: line.type,
                content: line.content,
                isIdLine: line.isIdLine
            });
        }
        if (line.newLineNumber !== undefined) {
            rightLineMap.set(line.newLineNumber, {
                type: line.type,
                content: line.content,
                isIdLine: line.isIdLine
            });
        }
    }
    
    // 创建并排布局
    diffHtml += `
        <div class="side-by-side-container">
            <div class="side-by-side-pane left-pane">
                <div class="pane-header">
                    <span class="pane-title">${escapeHtml(doc1.title)}</span>
                    <span class="pane-label old-file">原文档</span>
                </div>
                <div class="pane-content" id="left-pane-content">
    `;
    
    // 生成左侧内容（原文档）
    const leftLines = doc1.content.split('\n');
    for (let i = 0; i < leftLines.length; i++) {
        const lineNumber = i + 1;
        const content = processLineContent(leftLines[i]);
        const diffInfo = leftLineMap.get(lineNumber);
        
        let lineClass = 'side-line';
        if (diffInfo) {
            if (diffInfo.type === 'removed') {
                lineClass += diffInfo.isIdLine ? ' side-line-removed side-line-id' : ' side-line-removed';
            } else if (diffInfo.type === 'context') {
                lineClass += ' side-line-context';
            }
        }
        
        diffHtml += `
            <div class="${lineClass}" data-line-number="${lineNumber}">
                ${showLineNumbers ? `<div class="side-line-number" contenteditable="false">${lineNumber}</div>` : ''}
                <div class="side-line-content">${content}</div>
            </div>
        `;
    }
    
    diffHtml += `
                </div>
            </div>
            <div class="side-by-side-pane right-pane">
                <div class="pane-header">
                    <span class="pane-title">${escapeHtml(doc2.title)}</span>
                    <span class="pane-label new-file">新文档</span>
                    ${enableEditing ? '<button class="save-button" onclick="window.saveChanges && window.saveChanges()" title="保存更改">保存</button>' : ''}
                </div>
                <div class="pane-content" id="right-pane-content" ${enableEditing ? 'contenteditable="true"' : ''}>
    `;
    
    // 生成右侧内容（新文档）
    const rightLines = doc2.content.split('\n');
    for (let i = 0; i < rightLines.length; i++) {
        const lineNumber = i + 1;
        const content = processLineContent(rightLines[i]);
        const isEditable = enableEditing ? 'contenteditable="true"' : '';
        const diffInfo = rightLineMap.get(lineNumber);
        
        let lineClass = 'side-line';
        if (diffInfo) {
            if (diffInfo.type === 'added') {
                lineClass += diffInfo.isIdLine ? ' side-line-added side-line-id' : ' side-line-added';
            } else if (diffInfo.type === 'context') {
                lineClass += ' side-line-context';
            }
        }
        
        diffHtml += `
            <div class="${lineClass}" data-line-number="${lineNumber}">
                ${showLineNumbers ? `<div class="side-line-number" contenteditable="false">${lineNumber}</div>` : ''}
                <div class="side-line-content" ${isEditable}>${content}</div>
            </div>
        `;
    }
    
    diffHtml += `
                </div>
            </div>
        </div>
    `;
    
    return diffHtml;
}

/**
 * HTML转义并处理换行和空白字符
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    let escaped = div.innerHTML;
    
    // 处理空行显示
    if (escaped === '') {
        escaped = '&nbsp;'; // 使用不间断空格来显示空行
    }
    
    // 保留多个连续空格
    escaped = escaped.replace(/ {2,}/g, (match) => {
        return '&nbsp;'.repeat(match.length);
    });
    
    // 处理制表符
    escaped = escaped.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    
    return escaped;
}

/**
 * 处理行内容，确保正确显示换行和空白字符
 */
function processLineContent(content: string): string {
    // 如果是空行，显示为可见的空行
    if (content.trim() === '') {
        return '<span class="empty-line">&nbsp;</span>';
    }
    
    // 处理行首和行尾的空白字符
    const leadingSpaces = content.match(/^(\s*)/)?.[1] || '';
    const trailingSpaces = content.match(/(\s*)$/)?.[1] || '';
    const middleContent = content.slice(leadingSpaces.length, content.length - trailingSpaces.length);
    
    let processedContent = '';
    
    // 处理行首空白
    if (leadingSpaces) {
        processedContent += `<span class="leading-whitespace">${escapeHtml(leadingSpaces)}</span>`;
    }
    
    // 处理中间内容
    if (middleContent) {
        processedContent += escapeHtml(middleContent);
    }
    
    // 处理行尾空白
    if (trailingSpaces) {
        processedContent += `<span class="trailing-whitespace">${escapeHtml(trailingSpaces)}</span>`;
    }
    
    return processedContent;
}

/**
 * 生成可交换的差异视图HTML
 */
export function generateSwappableDiffHtml(doc1: any, doc2: any, swapCallback?: string, tooltipText?: string, revertCallback?: string, applyCallback?: string): string {
    const diffContent = generateDiffHtml(doc1, doc2, {
        mode: DiffViewMode.UNIFIED,
        enableLineActions: true
    });
    const callbackFunction = swapCallback || 'window.swapDocuments && window.swapDocuments()';
    const tooltip = tooltipText || '交换文档';
    const revertFunction = revertCallback || 'window.revertChanges && window.revertChanges()';
    
    return `
        <div class="diff-header">
            <div class="diff-file-header">
                <div class="diff-file-title old-file">
                    <span class="diff-file-icon">📄</span>
                    <span class="diff-file-name">${escapeHtml(doc1.title)}</span>
                </div>
                <div class="diff-action-buttons">
                    <button class="diff-action-button diff-revert-button" onclick="${revertFunction}" title="${escapeHtml('撤回为原文档内容')}">
                        <svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor">
                            <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7l-210.6 292a31.8 31.8 0 0 1-51.7 0L322.5 365.7c-13.7-19.1-2.2-46.7 23.6-46.7h46.4c10.2 0 19.9 4.9 25.9 13.3l71.2 98.8 157.2-218c6-8.3 15.6-13.3 25.9-13.3H719c25.8 0 37.3 27.6 23.5 46.7z" fill="#52c41a"/>
                        </svg>
                        撤回
                    </button>
                    <button class="diff-swap-button" onclick="${callbackFunction}" title="${escapeHtml(tooltip)}">
                        <svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor">
<path d="M162.909091 449.163636h681.890909c34.909091 0 65.163636-20.945455 76.8-51.2s6.981818-67.490909-16.290909-93.090909l-146.618182-153.6c-27.927273-27.927273-69.818182-27.927273-97.745454-2.327272-27.927273 25.6-27.927273 69.818182-2.327273 97.745454l58.181818 60.509091H162.909091c-39.563636 0-69.818182 30.254545-69.818182 69.818182s32.581818 72.145455 69.818182 72.145454zM861.090909 574.836364H179.2c-34.909091 0-65.163636 20.945455-76.8 51.2s-6.981818 67.490909 16.290909 93.090909l146.618182 153.6c13.963636 13.963636 32.581818 20.945455 51.2 20.945454 16.290909 0 34.909091-6.981818 48.872727-18.618182 27.927273-25.6 27.927273-69.818182 2.327273-97.745454l-58.181818-60.509091H861.090909c39.563636 0 69.818182-30.254545 69.818182-69.818182s-32.581818-72.145455-69.818182-72.145454z" p-id="5917" fill="#1296db"></path>
                        </svg>
                    </button>
                </div>
                <div class="diff-file-title new-file">
                    <span class="diff-file-icon">📄</span>
                    <span class="diff-file-name">${escapeHtml(doc2.title)}</span>
                </div>
            </div>
        </div>
        <div class="diff-content">
            ${diffContent}
        </div>
        <style>
            .doc-diff-container {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
                font-size: 12px;
                line-height: 1.4;
                background: #fff;
            }
            .diff-header {
                background: #f6f8fa;
                border-bottom: 1px solid #d1d9e0;
                padding: 8px 16px;
                position: sticky;
                top: 0;
                z-index: 1;
            }
            .diff-file-header {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 0;
                position: relative;
            }
            .diff-action-buttons {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 0 8px;
                position: relative;
                z-index: 2;
            }
            .diff-action-button, .diff-swap-button {
                background: #f6f8fa;
                border: 1px solid #d1d9e0;
                border-radius: 6px;
                padding: 6px 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                transition: all 0.2s ease;
                color: #586069;
                min-height: 28px;
                font-size: 12px;
                font-weight: 500;
            }
            .diff-action-button:hover, .diff-swap-button:hover {
                background: #e1e4e8;
                border-color: #c6cbd1;
                color: #24292e;
                transform: scale(1.05);
            }
            .diff-action-button:active, .diff-swap-button:active {
                background: #d1d5da;
                transform: scale(0.95);
            }
            .diff-action-button svg, .diff-swap-button svg {
                width: 16px;
                height: 16px;
                flex-shrink: 0;
            }
            .diff-revert-button {
                background: #fff2f0;
                border-color: #ffccc7;
                color: #cf1322;
            }
            .diff-revert-button:hover {
                background: #fff1f0;
                border-color: #ffa39e;
                color: #a8071a;
            }
            .diff-apply-button {
                background: #f6ffed;
                border-color: #b7eb8f;
                color: #389e0d;
            }
            .diff-apply-button:hover {
                background: #f6ffed;
                border-color: #95de64;
                color: #237804;
            }
            .diff-swap-button {
                min-width: 28px;
                padding: 6px;
            }
            .diff-file-title {
                display: flex;
                align-items: center;
                font-weight: 600;
                font-size: 14px;
                position: relative;
                flex: 1;
                padding: 8px 16px;
            }
            .diff-file-title.old-file {
                border-right: 2px solid #d1d9e0;
            }
            .diff-file-title.new-file {
                border-left: 2px solid #d1d9e0;
                margin-left: -2px;
            }
            .diff-file-icon {
                margin-right: 8px;
            }
            .old-file {
                color: #d73a49;
            }
            .new-file {
                color: #28a745;
            }
            .diff-stats {
                background: #f6f8fa;
                padding: 8px 16px;
                border-bottom: 1px solid #d1d9e0;
                font-size: 12px;
            }
            .diff-stat-item {
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            .diff-stat-additions {
                color: #28a745;
                font-weight: 600;
            }
            .diff-stat-deletions {
                color: #d73a49;
                font-weight: 600;
            }
            .diff-content {
                background: #fff;
                overflow-x: auto;
            }
            .diff-line {
                display: flex;
                font-family: inherit;
                font-size: inherit;
                line-height: inherit;
                min-height: 20px;
                position: relative;
            }
            .diff-line:hover {
                background-color: rgba(0, 0, 0, 0.04);
            }
            .diff-line:hover .diff-line-actions {
                opacity: 1;
            }
            .diff-line-actions {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                opacity: 0;
                transition: opacity 0.2s ease;
                z-index: 10;
            }
            .diff-line-action-btn {
                background: rgba(255, 255, 255, 0.9);
                border: 1px solid #d1d9e0;
                border-radius: 4px;
                padding: 2px 4px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                color: #586069;
                font-size: 10px;
                min-width: 20px;
                min-height: 16px;
                margin-left: 2px;
            }
            .diff-line-action-btn:hover {
                background: #fff;
                border-color: #c6cbd1;
                transform: scale(1.1);
            }
            .diff-line-action-btn:active {
                transform: scale(0.95);
            }
            .diff-revert-line-btn {
                color: #d73a49;
                border-color: #fdb8c0;
            }
            .diff-revert-line-btn:hover {
                background: #ffeef0;
                border-color: #f97583;
                color: #cb2431;
            }
            .diff-apply-line-btn {
                color: #28a745;
                border-color: #a2cbac;
            }
            .diff-apply-line-btn:hover {
                background: #f0fff4;
                border-color: #34d058;
                color: #22863a;
            }
            .diff-line-action-btn svg {
                width: 12px;
                height: 12px;
            }
            .diff-line-number {
                width: 50px;
                padding: 0 8px;
                text-align: right;
                background: #f6f8fa;
                border-right: 1px solid #d1d9e0;
                color: #586069;
                user-select: none;
                font-size: 11px;
                flex-shrink: 0;
            }
            .diff-line-content {
                flex: 1;
                padding: 0 8px;
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow-x: auto;
                min-height: 20px;
                display: flex;
                align-items: flex-start;
            }
            .diff-prefix {
                display: inline-block;
                width: 14px;
                flex-shrink: 0;
                font-weight: bold;
            }

            .leading-whitespace,
            .trailing-whitespace {
                background-color: rgba(255, 0, 0, 0.1);
                border-radius: 2px;
                position: relative;
            }
            .leading-whitespace::before,
            .trailing-whitespace::before {
                content: '·';
                position: absolute;
                color: rgba(0, 0, 0, 0.3);
                font-size: 8px;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
            }
            .diff-line-added .leading-whitespace,
            .diff-line-added .trailing-whitespace {
                background-color: rgba(40, 167, 69, 0.2);
            }
            .diff-line-removed .leading-whitespace,
            .diff-line-removed .trailing-whitespace {
                background-color: rgba(215, 58, 73, 0.2);
            }
            .diff-line-added {
                background: #e6ffed;
                color: #24292e;
            }
            .diff-line-added .diff-line-number {
                background: #cdffd8;
            }
            .diff-line-removed {
                background: #ffeef0;
                color: #24292e;
            }
            .diff-line-removed .diff-line-number {
                background: #fdb8c0;
            }
            /* ID行使用淡色样式 */
            .diff-line-id.diff-line-added {
                background: #f0fff4;
                color: #6a737d;
            }
            .diff-line-id.diff-line-added .diff-line-number {
                background: #e6ffed;
            }
            .diff-line-id.diff-line-removed {
                background: #fef8f8;
                color: #6a737d;
            }
            .diff-line-id.diff-line-removed .diff-line-number {
                background: #ffeef0;
            }
            .diff-line-context {
                background: #fff;
                color: #24292e;
            }
            .old-line-number {
                border-right: 1px solid #d1d9e0;
            }
            .new-line-number {
                border-right: 1px solid #d1d9e0;
            }
            
            /* 并排模式样式 */
            .side-by-side-container {
                display: flex;
                height: 100%;
                border: 1px solid #d1d9e0;
                border-radius: 6px;
                overflow: hidden;
            }
            
            .side-by-side-pane {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-width: 0;
            }
            
            .side-by-side-pane.left-pane {
                border-right: 1px solid #d1d9e0;
            }
            
            .pane-header {
                background: #f6f8fa;
                border-bottom: 1px solid #d1d9e0;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-weight: 600;
                font-size: 14px;
                position: sticky;
                top: 0;
                z-index: 1;
            }
            
            .pane-title {
                flex: 1;
                margin-right: 8px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .pane-label {
                font-size: 12px;
                padding: 2px 6px;
                border-radius: 3px;
                font-weight: 500;
            }
            
            .pane-label.old-file {
                background: #ffeef0;
                color: #d73a49;
            }
            
            .pane-label.new-file {
                background: #e6ffed;
                color: #28a745;
            }
            
            .save-button {
                background: #28a745;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                cursor: pointer;
                margin-left: 8px;
                transition: background-color 0.2s ease;
            }
            
            .save-button:hover {
                background: #22863a;
            }
            
            .save-button:active {
                background: #1e7e34;
            }
            
            .pane-content {
                flex: 1;
                overflow-y: auto;
                background: #fff;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
                font-size: 12px;
                line-height: 1.4;
            }
            
            .pane-content[contenteditable="true"] {
                outline: none;
                border: 2px solid transparent;
                transition: border-color 0.2s ease;
            }
            
            .pane-content[contenteditable="true"]:focus {
                border-color: #0366d6;
            }
            
            .side-line {
                display: flex;
                min-height: 20px;
                border-bottom: 1px solid #f6f8fa;
            }
            
            .side-line:hover {
                background-color: rgba(0, 0, 0, 0.04);
            }
            
            .side-line-number {
                width: 50px;
                padding: 0 8px;
                text-align: right;
                background: #f6f8fa;
                border-right: 1px solid #d1d9e0;
                color: #586069;
                user-select: none;
                font-size: 11px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: flex-end;
            }
            
            .side-line-content {
                flex: 1;
                padding: 0 8px;
                white-space: pre-wrap;
                word-wrap: break-word;
                min-height: 20px;
                display: flex;
                align-items: flex-start;
            }
            
            .side-line-content[contenteditable="true"] {
                outline: none;
                background: #fff;
                transition: background-color 0.2s ease;
            }
            
            .side-line-content[contenteditable="true"]:focus {
                background: #f0f8ff;
            }
        </style>
    `;
}

/**
 * 生成完整的差异视图HTML（保持向后兼容）
 */
export function generateFullDiffHtml(doc1: any, doc2: any): string {
    const diffContent = generateDiffHtml(doc1, doc2, { mode: DiffViewMode.UNIFIED });
    
    return `
        <div class="diff-header">
            <div class="diff-file-header">
                <div class="diff-file-title old-file">
                    <span class="diff-file-icon">📄</span>
                    <span class="diff-file-name">${escapeHtml(doc1.title)}</span>
                </div>
                <div class="diff-file-title new-file">
                    <span class="diff-file-icon">📄</span>
                    <span class="diff-file-name">${escapeHtml(doc2.title)}</span>
                </div>
            </div>
        </div>
        <div class="diff-content">
            ${diffContent}
        </div>
        <style>
            .doc-diff-container {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
                font-size: 12px;
                line-height: 1.4;
                background: #fff;
            }
            .diff-header {
                background: #f6f8fa;
                border-bottom: 1px solid #d1d9e0;
                padding: 8px 16px;
                position: sticky;
                top: 0;
                z-index: 1;
            }
            .diff-file-header {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 0;
                position: relative;
            }
            .diff-file-title {
                display: flex;
                align-items: center;
                font-weight: 600;
                font-size: 14px;
                position: relative;
                flex: 1;
                padding: 8px 16px;
            }
            .diff-file-title.old-file {
                border-right: 2px solid #d1d9e0;
            }
            .diff-file-title.new-file {
                border-left: 2px solid #d1d9e0;
                margin-left: -2px;
            }
            .diff-file-icon {
                margin-right: 8px;
            }
            .old-file {
                color: #d73a49;
            }
            .new-file {
                color: #28a745;
            }
            .diff-stats {
                background: #f6f8fa;
                padding: 8px 16px;
                border-bottom: 1px solid #d1d9e0;
                font-size: 12px;
            }
            .diff-stat-item {
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            .diff-stat-additions {
                color: #28a745;
                font-weight: 600;
            }
            .diff-stat-deletions {
                color: #d73a49;
                font-weight: 600;
            }
            .diff-content {
                background: #fff;
                overflow-x: auto;
            }
            .diff-line {
                display: flex;
                font-family: inherit;
                font-size: inherit;
                line-height: inherit;
                min-height: 20px;
            }
            .diff-line:hover {
                background-color: rgba(0, 0, 0, 0.04);
            }
            .diff-line-number {
                width: 50px;
                padding: 0 8px;
                text-align: right;
                background: #f6f8fa;
                border-right: 1px solid #d1d9e0;
                color: #586069;
                user-select: none;
                font-size: 11px;
                flex-shrink: 0;
            }
            .diff-line-content {
                flex: 1;
                padding: 0 8px;
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow-x: auto;
                min-height: 20px;
                display: flex;
                align-items: flex-start;
            }
            .diff-prefix {
                display: inline-block;
                width: 14px;
                flex-shrink: 0;
                font-weight: bold;
            }

            .leading-whitespace,
            .trailing-whitespace {
                background-color: rgba(255, 0, 0, 0.1);
                border-radius: 2px;
                position: relative;
            }
            .leading-whitespace::before,
            .trailing-whitespace::before {
                content: '·';
                position: absolute;
                color: rgba(0, 0, 0, 0.3);
                font-size: 8px;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
            }
            .diff-line-added .leading-whitespace,
            .diff-line-added .trailing-whitespace {
                background-color: rgba(40, 167, 69, 0.2);
            }
            .diff-line-removed .leading-whitespace,
            .diff-line-removed .trailing-whitespace {
                background-color: rgba(215, 58, 73, 0.2);
            }
            .diff-line-added {
                background: #e6ffed;
                color: #24292e;
            }
            .diff-line-added .diff-line-number {
                background: #cdffd8;
            }
            .diff-line-removed {
                background: #ffeef0;
                color: #24292e;
            }
            .diff-line-removed .diff-line-number {
                background: #fdb8c0;
            }
            /* ID行使用淡色样式 */
            .diff-line-id.diff-line-added {
                background: #f0fff4;
                color: #6a737d;
            }
            .diff-line-id.diff-line-added .diff-line-number {
                background: #e6ffed;
            }
            .diff-line-id.diff-line-removed {
                background: #fef8f8;
                color: #6a737d;
            }
            .diff-line-id.diff-line-removed .diff-line-number {
                background: #ffeef0;
            }
            .diff-line-context {
                background: #fff;
                color: #24292e;
            }
            .old-line-number {
                border-right: 1px solid #d1d9e0;
            }
            .new-line-number {
                border-right: 1px solid #d1d9e0;
            }
        </style>
    `;
}
/**
 * 生成支持模式切换的差异视图HTML
 */
export function generateModeSwitchableDiffHtml(
    doc1: any, 
    doc2: any, 
    currentMode: DiffViewMode = DiffViewMode.UNIFIED,
    callbacks?: {
        swapCallback?: string;
        revertCallback?: string;
        saveCallback?: string;
        modeChangeCallback?: string;
    }
): string {
    const options: DiffViewOptions = {
        mode: currentMode,
        enableLineActions: currentMode === DiffViewMode.UNIFIED,
        enableEditing: currentMode === DiffViewMode.SIDE_BY_SIDE,
        showLineNumbers: true
    };
    
    const diffContent = generateDiffHtml(doc1, doc2, options);
    
    const swapFunction = callbacks?.swapCallback || 'window.swapDocuments && window.swapDocuments()';
    const revertFunction = callbacks?.revertCallback || 'window.revertChanges && window.revertChanges()';
    const saveFunction = callbacks?.saveCallback || 'window.saveChanges && window.saveChanges()';
    const modeChangeFunction = callbacks?.modeChangeCallback || 'window.switchDiffMode && window.switchDiffMode';
    
    return `
        <div class="diff-header">
            <div class="diff-file-header">
                <div class="diff-file-title old-file">
                    <span class="diff-file-icon">📄</span>
                    <span class="diff-file-name">${escapeHtml(doc1.title)}</span>
                </div>
                <div class="diff-action-buttons">
                    <div class="diff-mode-switcher">
                        <button class="diff-mode-button ${currentMode === DiffViewMode.UNIFIED ? 'active' : ''}" 
                                onclick="${modeChangeFunction}('${DiffViewMode.UNIFIED}')" 
                                title="合并模式">
                            <svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor">
                                <path d="M128 256h768v85.333H128V256z m0 170.667h768v85.333H128v-85.333z m0 170.666h768V682.667H128v-85.334z m0 170.667h768V853.333H128v-85.333z"/>
                            </svg>
                            合并
                        </button>
                        <button class="diff-mode-button ${currentMode === DiffViewMode.SIDE_BY_SIDE ? 'active' : ''}" 
                                onclick="${modeChangeFunction}('${DiffViewMode.SIDE_BY_SIDE}')" 
                                title="并排模式">
                            <svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor">
                                <path d="M128 128h341.333v768H128V128z m426.667 0H896v768H554.667V128z"/>
                            </svg>
                            并排
                        </button>
                    </div>
                    ${currentMode === DiffViewMode.SIDE_BY_SIDE ? 
                        `<button class="diff-action-button diff-save-button" onclick="${saveFunction}" title="保存更改">
                            <svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor">
                                <path d="M893.3 293.3L730.7 130.7c-7.5-7.5-16.7-13-26.7-16V112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V338.5c0-17-6.7-33.2-18.7-45.2zM384 184h256v104H384V184z m456 656H184V184h136v136c0 17.7 14.3 32 32 32h320c17.7 0 32-14.3 32-32V205.8l96 96V840z"/>
                            </svg>
                            保存
                        </button>` : ''
                    }
                    <button class="diff-action-button diff-revert-button" onclick="${revertFunction}" title="撤回为原文档内容">
                        <svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor">
                            <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7l-210.6 292a31.8 31.8 0 0 1-51.7 0L322.5 365.7c-13.7-19.1-2.2-46.7 23.6-46.7h46.4c10.2 0 19.9 4.9 25.9 13.3l71.2 98.8 157.2-218c6-8.3 15.6-13.3 25.9-13.3H719c25.8 0 37.3 27.6 23.5 46.7z" fill="#52c41a"/>
                        </svg>
                        撤回
                    </button>
                    <button class="diff-swap-button" onclick="${swapFunction}" title="交换文档">
                        <svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor">
                            <path d="M162.909091 449.163636h681.890909c34.909091 0 65.163636-20.945455 76.8-51.2s6.981818-67.490909-16.290909-93.090909l-146.618182-153.6c-27.927273-27.927273-69.818182-27.927273-97.745454-2.327272-27.927273 25.6-27.927273 69.818182-2.327273 97.745454l58.181818 60.509091H162.909091c-39.563636 0-69.818182 30.254545-69.818182 69.818182s32.581818 72.145455 69.818182 72.145454zM861.090909 574.836364H179.2c-34.909091 0-65.163636 20.945455-76.8 51.2s-6.981818 67.490909 16.290909 93.090909l146.618182 153.6c13.963636 13.963636 32.581818 20.945455 51.2 20.945454 16.290909 0 34.909091-6.981818 48.872727-18.618182 27.927273-25.6 27.927273-69.818182 2.327273-97.745454l-58.181818-60.509091H861.090909c39.563636 0 69.818182-30.254545 69.818182-69.818182s-32.581818-72.145455-69.818182-72.145454z" p-id="5917" fill="#1296db"/>
                        </svg>
                    </button>
                </div>
                <div class="diff-file-title new-file">
                    <span class="diff-file-icon">📄</span>
                    <span class="diff-file-name">${escapeHtml(doc2.title)}</span>
                </div>
            </div>
        </div>
        <div class="diff-content">
            ${diffContent}
        </div>
        <style>
            .doc-diff-container {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
                font-size: 12px;
                line-height: 1.4;
                background: #fff;
            }
            .diff-header {
                background: #f6f8fa;
                border-bottom: 1px solid #d1d9e0;
                padding: 8px 16px;
                position: sticky;
                top: 0;
                z-index: 1;
            }
            .diff-file-header {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 0;
                position: relative;
            }
            .diff-action-buttons {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 0 8px;
                position: relative;
                z-index: 2;
            }
            .diff-mode-switcher {
                display: flex;
                background: #fff;
                border: 1px solid #d1d9e0;
                border-radius: 6px;
                overflow: hidden;
                margin-right: 8px;
            }
            .diff-mode-button {
                background: #fff;
                border: none;
                padding: 6px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                transition: all 0.2s ease;
                color: #586069;
                font-size: 12px;
                font-weight: 500;
                border-right: 1px solid #d1d9e0;
            }
            .diff-mode-button:last-child {
                border-right: none;
            }
            .diff-mode-button:hover {
                background: #f6f8fa;
                color: #24292e;
            }
            .diff-mode-button.active {
                background: #0366d6;
                color: #fff;
            }
            .diff-mode-button.active:hover {
                background: #0256cc;
            }
            .diff-action-button, .diff-swap-button {
                background: #f6f8fa;
                border: 1px solid #d1d9e0;
                border-radius: 6px;
                padding: 6px 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                transition: all 0.2s ease;
                color: #586069;
                min-height: 28px;
                font-size: 12px;
                font-weight: 500;
            }
            .diff-action-button:hover, .diff-swap-button:hover {
                background: #e1e4e8;
                border-color: #c6cbd1;
                color: #24292e;
                transform: scale(1.05);
            }
            .diff-action-button:active, .diff-swap-button:active {
                background: #d1d5da;
                transform: scale(0.95);
            }
            .diff-action-button svg, .diff-swap-button svg {
                width: 16px;
                height: 16px;
                flex-shrink: 0;
            }
            .diff-save-button {
                background: #f6ffed;
                border-color: #b7eb8f;
                color: #389e0d;
            }
            .diff-save-button:hover {
                background: #f6ffed;
                border-color: #95de64;
                color: #237804;
            }
            .diff-revert-button {
                background: #fff2f0;
                border-color: #ffccc7;
                color: #cf1322;
            }
            .diff-revert-button:hover {
                background: #fff1f0;
                border-color: #ffa39e;
                color: #a8071a;
            }
            .diff-swap-button {
                min-width: 28px;
                padding: 6px;
            }
            .diff-file-title {
                display: flex;
                align-items: center;
                font-weight: 600;
                font-size: 14px;
                position: relative;
                flex: 1;
                padding: 8px 16px;
            }
            .diff-file-title.old-file {
                border-right: 2px solid #d1d9e0;
            }
            .diff-file-title.new-file {
                border-left: 2px solid #d1d9e0;
                margin-left: -2px;
            }
            .diff-file-icon {
                margin-right: 8px;
            }
            .old-file {
                color: #d73a49;
            }
            .new-file {
                color: #28a745;
            }
            .diff-stats {
                background: #f6f8fa;
                padding: 8px 16px;
                border-bottom: 1px solid #d1d9e0;
                font-size: 12px;
            }
            .diff-stat-item {
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            .diff-stat-additions {
                color: #28a745;
                font-weight: 600;
            }
            .diff-stat-deletions {
                color: #d73a49;
                font-weight: 600;
            }
            .diff-content {
                background: #fff;
                overflow-x: auto;
            }
            .diff-line {
                display: flex;
                font-family: inherit;
                font-size: inherit;
                line-height: inherit;
                min-height: 20px;
                position: relative;
            }
            .diff-line:hover {
                background-color: rgba(0, 0, 0, 0.04);
            }
            .diff-line:hover .diff-line-actions {
                opacity: 1;
            }
            .diff-line-actions {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                opacity: 0;
                transition: opacity 0.2s ease;
                z-index: 10;
            }
            .diff-line-action-btn {
                background: rgba(255, 255, 255, 0.9);
                border: 1px solid #d1d9e0;
                border-radius: 4px;
                padding: 2px 4px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                color: #586069;
                font-size: 10px;
                min-width: 20px;
                min-height: 16px;
                margin-left: 2px;
            }
            .diff-line-action-btn:hover {
                background: #fff;
                border-color: #c6cbd1;
                transform: scale(1.1);
            }
            .diff-line-action-btn:active {
                transform: scale(0.95);
            }
            .diff-revert-line-btn {
                color: #d73a49;
                border-color: #fdb8c0;
            }
            .diff-revert-line-btn:hover {
                background: #ffeef0;
                border-color: #f97583;
                color: #cb2431;
            }
            .diff-line-action-btn svg {
                width: 12px;
                height: 12px;
            }
            .diff-line-number {
                width: 50px;
                padding: 0 8px;
                text-align: right;
                background: #f6f8fa;
                border-right: 1px solid #d1d9e0;
                color: #586069;
                user-select: none;
                font-size: 11px;
                flex-shrink: 0;
            }
            .diff-line-content {
                flex: 1;
                padding: 0 8px;
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow-x: auto;
                min-height: 20px;
                display: flex;
                align-items: flex-start;
            }
            .diff-prefix {
                display: inline-block;
                width: 14px;
                flex-shrink: 0;
                font-weight: bold;
            }

            .leading-whitespace,
            .trailing-whitespace {
                background-color: rgba(255, 0, 0, 0.1);
                border-radius: 2px;
                position: relative;
            }
            .leading-whitespace::before,
            .trailing-whitespace::before {
                content: '·';
                position: absolute;
                color: rgba(0, 0, 0, 0.3);
                font-size: 8px;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
            }
            .diff-line-added .leading-whitespace,
            .diff-line-added .trailing-whitespace {
                background-color: rgba(40, 167, 69, 0.2);
            }
            .diff-line-removed .leading-whitespace,
            .diff-line-removed .trailing-whitespace {
                background-color: rgba(215, 58, 73, 0.2);
            }
            .diff-line-added {
                background: #e6ffed;
                color: #24292e;
            }
            .diff-line-added .diff-line-number {
                background: #cdffd8;
            }
            .diff-line-removed {
                background: #ffeef0;
                color: #24292e;
            }
            .diff-line-removed .diff-line-number {
                background: #fdb8c0;
            }
            /* ID行使用淡色样式 */
            .diff-line-id.diff-line-added {
                background: #f0fff4;
                color: #6a737d;
            }
            .diff-line-id.diff-line-added .diff-line-number {
                background: #e6ffed;
            }
            .diff-line-id.diff-line-removed {
                background: #fef8f8;
                color: #6a737d;
            }
            .diff-line-id.diff-line-removed .diff-line-number {
                background: #ffeef0;
            }
            .diff-line-context {
                background: #fff;
                color: #24292e;
            }
            .old-line-number {
                border-right: 1px solid #d1d9e0;
            }
            .new-line-number {
                border-right: 1px solid #d1d9e0;
            }
            
            /* 并排模式样式 */
            .side-by-side-container {
                display: flex;
                height: 100%;
                border: 1px solid #d1d9e0;
                border-radius: 6px;
                overflow: hidden;
            }
            
            .side-by-side-pane {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-width: 0;
            }
            
            .side-by-side-pane.left-pane {
                border-right: 1px solid #d1d9e0;
            }
            
            .pane-header {
                background: #f6f8fa;
                border-bottom: 1px solid #d1d9e0;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-weight: 600;
                font-size: 14px;
                position: sticky;
                top: 0;
                z-index: 1;
            }
            
            .pane-title {
                flex: 1;
                margin-right: 8px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .pane-label {
                font-size: 12px;
                padding: 2px 6px;
                border-radius: 3px;
                font-weight: 500;
            }
            
            .pane-label.old-file {
                background: #ffeef0;
                color: #d73a49;
            }
            
            .pane-label.new-file {
                background: #e6ffed;
                color: #28a745;
            }
            
            .save-button {
                background: #28a745;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                cursor: pointer;
                margin-left: 8px;
                transition: background-color 0.2s ease;
            }
            
            .save-button:hover {
                background: #22863a;
            }
            
            .save-button:active {
                background: #1e7e34;
            }
            
            .pane-content {
                flex: 1;
                overflow-y: auto;
                background: #fff;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
                font-size: 12px;
                line-height: 1.4;
            }
            
            .pane-content[contenteditable="true"] {
                outline: none;
                border: 2px solid transparent;
                transition: border-color 0.2s ease;
            }
            
            .pane-content[contenteditable="true"]:focus {
                border-color: #0366d6;
            }
            
            .side-line {
                display: flex;
                min-height: 20px;
                border-bottom: 1px solid #f6f8fa;
            }
            
            .side-line:hover {
                background-color: rgba(0, 0, 0, 0.04);
            }
            
            /* 并排模式的差异行样式 */
            .side-line-added {
                background: #e6ffed;
                color: #24292e;
            }
            
            .side-line-added .side-line-number {
                background: #cdffd8;
            }
            
            .side-line-removed {
                background: #ffeef0;
                color: #24292e;
            }
            
            .side-line-removed .side-line-number {
                background: #fdb8c0;
            }
            
            .side-line-context {
                background: #fff;
                color: #24292e;
            }
            
            /* 并排模式ID行使用淡色样式 */
            .side-line-id.side-line-added {
                background: #f0fff4;
                color: #6a737d;
            }
            
            .side-line-id.side-line-added .side-line-number {
                background: #e6ffed;
            }
            
            .side-line-id.side-line-removed {
                background: #fef8f8;
                color: #6a737d;
            }
            
            .side-line-id.side-line-removed .side-line-number {
                background: #ffeef0;
            }
            
            /* 并排模式中的空白字符样式 */
            .side-line-added .leading-whitespace,
            .side-line-added .trailing-whitespace {
                background-color: rgba(40, 167, 69, 0.2);
            }
            
            .side-line-removed .leading-whitespace,
            .side-line-removed .trailing-whitespace {
                background-color: rgba(215, 58, 73, 0.2);
            }
            
            .side-line-number {
                width: 50px;
                padding: 0 8px;
                text-align: right;
                background: #f6f8fa;
                border-right: 1px solid #d1d9e0;
                color: #586069;
                user-select: none;
                font-size: 11px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                cursor: default;
                pointer-events: none;
            }
            
            .side-line-number[contenteditable="false"] {
                outline: none !important;
                cursor: default !important;
                pointer-events: none !important;
            }
            
            .side-line-content {
                flex: 1;
                padding: 0 8px;
                white-space: pre-wrap;
                word-wrap: break-word;
                min-height: 20px;
                display: flex;
                align-items: flex-start;
            }
            
            .side-line-content[contenteditable="true"] {
                outline: none;
                background: #fff;
                transition: background-color 0.2s ease;
            }
            
            .side-line-content[contenteditable="true"]:focus {
                background: #f0f8ff;
            }
        </style>
    `;
}