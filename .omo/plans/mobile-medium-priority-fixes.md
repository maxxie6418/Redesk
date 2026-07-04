# 移动端中优先级修复计划

## 概述

基于移动端代码与设计评审结果，执行中优先级修复以优化移动端体验。

## 修复任务

### 1. 优化响应式断点

**文件**：`apps/web/src/hooks/use-mobile-layout.ts`

**当前状态**：
- 使用 `(max-width: 1023px)` 作为移动端断点
- 这意味着宽度小于 1024px 的设备都会被视为移动端
- 平板设备也被视为移动端，可能导致布局不适配

**修复方案**：
1. 将移动端断点改为 `(max-width: 767px)`
2. 添加平板设备断点 `(min-width: 768px) and (max-width: 1023px)`
3. 添加 `useTabletLayout` Hook 供平板设备使用
4. 更新相关组件以支持平板设备布局

**验收标准**：
- 移动端（<768px）使用移动端布局
- 平板设备（768px-1023px）使用适配布局
- 桌面设备（>=1024px）使用桌面布局

### 2. 优化字体大小

**文件**：`apps/web/src/components/mobile-app-shell.tsx`、`apps/web/src/components/mobile-bookshelf.tsx`、`apps/web/src/components/mobile-book-detail-sheet.tsx`

**当前状态**：
- 使用 `text-[11px]` 和 `text-[10px]` 非常小的字体
- 在某些设备上可能显示不清

**修复方案**：
1. 将 `text-[11px]` 改为 `text-xs`（12px）
2. 将 `text-[10px]` 改为 `text-[11px]` 或 `text-xs`（12px）
3. 确保字体大小在不同设备上可读

**验收标准**：
- 所有文本在移动设备上清晰可读
- 字体大小符合移动端设计规范

### 3. 优化暗色模式适配

**文件**：`apps/web/src/components/mobile-bookshelf.tsx`、`apps/web/src/components/mobile-book-detail-sheet.tsx`

**当前状态**：
- 使用硬编码颜色（如 `bg-[rgba(255,250,241,0.92)]`）
- 在暗色模式下可能显示异常

**修复方案**：
1. 将硬编码颜色替换为 CSS 变量
2. 使用 `bg-card`、`bg-muted` 等语义化类名
3. 确保暗色模式下颜色正确

**验收标准**：
- 亮色模式和暗色模式下颜色正确
- 所有组件在两种模式下都正常显示

## 执行顺序

1. 优化响应式断点（影响最大）
2. 优化字体大小（影响可读性）
3. 优化暗色模式适配（影响视觉体验）

## 测试验证

1. **响应式断点测试**：
   - 在 Chrome DevTools 中测试不同设备和视口大小
   - 验证移动端、平板设备、桌面设备的布局切换

2. **字体大小测试**：
   - 在不同设备上检查文本可读性
   - 确保字体大小符合设计规范

3. **暗色模式测试**：
   - 切换亮色和暗色模式
   - 验证所有组件在两种模式下都正常显示

## 注意事项

- 修复时保持现有功能不变
- 确保修复后不会引入新的问题
- 修复后运行 `pnpm typecheck` 和 `pnpm lint` 检查代码质量