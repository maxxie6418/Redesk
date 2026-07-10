# Checklist

## Phase 1: 数据库与共享类型
- [x] `users` 表新增 `permission_level` 字段，默认 `'use'`
- [x] `books` 表 `visibility` 默认值改为 `PUBLIC`
- [x] Migration 文件已创建并记录在 journal
- [x] `PERMISSION_LEVEL` 枚举已添加到 `enums.ts`
- [x] `permissionLevelSchema` 已添加到 `schemas.ts`
- [x] `updateUserSchema` 支持 `permission_level` 字段

## Phase 2: 后端权限校验
- [x] `getPermissionLevel()` 函数已实现
- [x] `requirePermission()` 函数已实现
- [x] 管理员通过 `requirePermission()` 时被视为拥有所有权限
- [x] 书籍列表接口支持匿名访问（仅 public 书籍）
- [x] 书籍写操作要求 `use` 权限
- [x] 高亮查询按书籍 visibility 过滤
- [x] 高亮写操作要求 `read` 权限
- [x] 笔记永远按 owner_id 隔离
- [x] 笔记写操作要求 `read` 权限
- [x] 文件访问要求 `read` 权限
- [x] 导出功能要求 `use` 权限
- [x] 用户管理接口支持设置/修改 permission_level

## Phase 3: 前端改造
- [x] 用户管理界面显示权限级别
- [x] 用户管理界面支持修改权限级别
- [x] 未登录用户可看到公开书架列表
- [x] 未登录用户点击书籍跳转登录页
- [x] 浏览用户书籍详情页不显示文件相关元素
- [x] 阅读用户可看到并操作自己的高亮/笔记
- [x] 使用用户看到完整功能界面

## Phase 4: 验证
- [ ] 匿名用户只能访问公开书架列表
- [ ] 浏览用户无法打开阅读器或下载文件
- [ ] 阅读用户可以阅读但无法上传书籍
- [ ] 使用用户拥有完整非管理功能
- [ ] 管理员不受权限限制
- [ ] 高亮在公开书上对所有登录用户可见
- [ ] 笔记仅对 owner 可见
- [ ] 新建书籍默认为 PUBLIC