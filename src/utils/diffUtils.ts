/**
 * 文档差异比较工具类
 * 实现类似GitHub的diff算法
 */

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
 * 生成差异HTML
 */
export function generateDiffHtml(doc1: any, doc2: any): string {
    const diffResult = computeTextDiff(doc1.content, doc2.content);
    
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
    for (const line of diffResult.lines) {
        const oldLineNum = line.oldLineNumber || '';
        const newLineNum = line.newLineNumber || '';
        const content = processLineContent(line.content);
        
        let lineClass = '';
        let prefix = '';
        
        switch (line.type) {
            case 'added':
                lineClass = line.isIdLine ? 'diff-line-added diff-line-id' : 'diff-line-added';
                prefix = '<span class="diff-prefix">+</span>';
                break;
            case 'removed':
                lineClass = line.isIdLine ? 'diff-line-removed diff-line-id' : 'diff-line-removed';
                prefix = '<span class="diff-prefix">-</span>';
                break;
            case 'context':
                lineClass = 'diff-line-context';
                prefix = '<span class="diff-prefix">&nbsp;</span>';
                break;
        }
        
        diffHtml += `
            <div class="diff-line ${lineClass}">
                <div class="diff-line-number old-line-number">${oldLineNum}</div>
                <div class="diff-line-number new-line-number">${newLineNum}</div>
                <div class="diff-line-content">${prefix}${content}</div>
            </div>
        `;
    }
    
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
export function generateSwappableDiffHtml(doc1: any, doc2: any, swapCallback?: string, tooltipText?: string): string {
    const diffContent = generateDiffHtml(doc1, doc2);
    const callbackFunction = swapCallback || 'window.swapDocuments && window.swapDocuments()';
    const tooltip = tooltipText || '交换文档';
    
    return `
        <div class="diff-header">
            <div class="diff-file-header">
                <div class="diff-file-title old-file">
                    <span class="diff-file-icon">📄</span>
                    <span class="diff-file-name">${escapeHtml(doc1.title)}</span>
                </div>
                <div class="diff-swap-button-container">
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
            .diff-swap-button-container {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 8px;
                position: relative;
                z-index: 2;
            }
            .diff-swap-button {
                background: #f6f8fa;
                border: 1px solid #d1d9e0;
                border-radius: 6px;
                padding: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                color: #586069;
                min-width: 28px;
                min-height: 28px;
            }
            .diff-swap-button:hover {
                background: #e1e4e8;
                border-color: #c6cbd1;
                color: #24292e;
                transform: scale(1.05);
            }
            .diff-swap-button:active {
                background: #d1d5da;
                transform: scale(0.95);
            }
            .diff-swap-button svg {
                width: 16px;
                height: 16px;
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
 * 生成完整的差异视图HTML（保持向后兼容）
 */
export function generateFullDiffHtml(doc1: any, doc2: any): string {
    const diffContent = generateDiffHtml(doc1, doc2);
    
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