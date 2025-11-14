# 微信公众号文章抓取工具 - Web版

## 📱 完美支持移动端和桌面端

这是一个基于 Node.js + Express 开发的微信公众号文章抓取工具Web版，支持桌面端和移动端访问。

## ✨ 主要特性

- ✅ **响应式设计** - 完美适配桌面、平板、手机
- ✅ **现代化UI** - 简洁美观的用户界面
- ✅ **实时搜索** - 快速搜索文章标题
- ✅ **灵活排序** - 支持时间正序和倒序
- ✅ **Excel导出** - 一键导出文章列表
- ✅ **移动端优化** - 滑动菜单、触摸友好
- ✅ **本地存储** - 公众号列表自动保存

## 🚀 快速开始

### 环境要求

- Node.js 14.0 或更高版本
- npm 或 yarn

### 安装步骤

1. **安装依赖**

```bash
npm install
```

2. **配置环境变量（可选）**

```bash
cp .env.example .env
# 编辑 .env 文件，修改端口和密钥
```

3. **启动服务器**

**生产模式：**
```bash
npm start
```

**开发模式（自动重启）：**
```bash
npm run dev
```

4. **访问应用**

- 桌面端：打开浏览器访问 `http://localhost:3000`
- 移动端：在同一局域网内，访问 `http://[你的电脑IP]:3000`

### 查找你的IP地址

**Mac/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig
```

## 📖 使用指南

### 第一步：配置参数

1. 点击右上角的 **"设置"** 按钮（移动端点击 ⚙️ 图标）
2. 填入以下参数：
   - **Cookie** - 必填
   - **Token** - 必填  
   - **Fingerprint** - 可选
3. 点击 **"保存设置"**

### 获取配置参数的方法

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 "素材管理" → "图文消息"
3. 按 **F12** 打开开发者工具
4. 切换到 **Network（网络）** 标签
5. 在页面中进行任何操作（比如搜索素材）
6. 在 Network 中找到包含 `token` 的请求
7. 从请求中复制：
   - **Cookie**（从请求头 Headers 中）
   - **token**（从 URL 参数中）

### 第二步：添加公众号

1. 在左侧输入框输入公众号名称
2. 点击 **"添加"** 按钮
3. 等待搜索完成

### 第三步：查看文章

1. 点击公众号列表中的任意公众号
2. 自动加载文章列表
3. 使用搜索框快速查找文章
4. 点击文章卡片查看详情
5. 点击 **"加载更多"** 获取更多文章

### 第四步：导出数据

1. 选择公众号并加载文章
2. 点击右上角 **"导出Excel"** 按钮
3. 选择保存位置

## 📱 移动端使用技巧

### 访问方式

1. 确保手机和电脑在同一 WiFi 网络
2. 在手机浏览器输入：`http://[电脑IP]:3000`
3. 建议添加到主屏幕，像App一样使用

### 操作指南

- **打开菜单** - 点击左上角 ☰ 按钮
- **选择公众号** - 在侧边栏点击公众号（自动关闭菜单）
- **搜索文章** - 使用顶部搜索框
- **查看详情** - 点击文章卡片
- **返回列表** - 点击左上角 ← 按钮
- **打开设置** - 点击右上角 ⚙️ 图标

### 添加到主屏幕

**iOS（Safari）：**
1. 打开网站
2. 点击底部分享按钮
3. 选择 "添加到主屏幕"

**Android（Chrome）：**
1. 打开网站
2. 点击菜单按钮（三个点）
3. 选择 "添加到主屏幕"

## 🔧 技术架构

### 后端
- **框架**: Express.js
- **HTTP客户端**: Axios
- **Session**: express-session
- **Excel**: ExcelJS

### 前端
- **原生JavaScript** - 无框架依赖
- **CSS3** - 响应式设计
- **LocalStorage** - 本地数据持久化

### 响应式断点
- 桌面端：> 1024px
- 平板：768px - 1024px
- 手机：< 768px
- 小屏手机：< 480px

## ⚠️ 注意事项

### 频率限制

- 建议每次请求间隔 **500ms** 以上
- 避免短时间内大量请求
- 被限制后需等待一段时间

### 参数有效期

- **Cookie**: 通常 7-30 天
- **Token**: 通常 24 小时
- 过期后需要重新获取

### 安全建议

- 不要将 Cookie 和 Token 泄露给他人
- 建议在本地网络内使用
- 生产环境请启用 HTTPS
- 修改 `.env` 中的 SESSION_SECRET

## 🌐 部署到服务器

### 使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name wechat-web

# 查看状态
pm2 status

# 查看日志
pm2 logs wechat-web

# 设置开机自启
pm2 startup
pm2 save
```

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🎨 自定义配置

### 修改端口

编辑 `.env` 文件：
```
PORT=8080
```

### 修改主题色

编辑 `public/css/style.css` 中的 CSS 变量：
```css
:root {
  --primary-color: #1890ff;  /* 主题色 */
  --success-color: #52c41a;  /* 成功色 */
  /* ... */
}
```

## 🐛 常见问题

### Q: 无法添加公众号？
A: 请先在设置中配置 Cookie 和 Token，确保参数有效。

### Q: 提示 "登录已过期"？
A: Token 已过期，请重新获取并保存。

### Q: 移动端无法访问？
A: 确保手机和电脑在同一网络，检查防火墙设置。

### Q: 文章加载失败？
A: 可能是请求频率过快，等待几分钟后重试。

### Q: 导出的Excel乱码？
A: 使用 Excel 2016 或更高版本打开，或使用 WPS Office。

## 📄 许可证

MIT License

## 🙏 免责声明

本工具仅用于学习研究，请勿用于非法用途。使用本工具时请遵守相关法律法规，注意采集频率，避免对目标服务器造成影响。

## 📧 反馈与支持

如有问题或建议，欢迎提交 Issue。

---

**享受使用！** 🎉

