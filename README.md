# HumanVis 动作数据可视化

一个基于 Three.js 的本地网页工具，用于加载与预览 BVH/FBX 动作数据，支持播放控制、时间轴、骨骼/物体信息展示以及深/浅色主题。

## 功能
- 本地运行，无需后端
- 选择或拖拽导入 BVH/FBX 文件
- 播放/暂停/停止、速度调节、循环播放
- 统一时间轴与时间显示（含帧信息）
- 动作信息面板：帧数、帧率、时长、关节数、骨骼/物体列表
- FBX 蒙皮显隐开关、骨骼/物体悬停高亮
- 深色/浅色主题切换（自动记忆）

## 快速开始
1) 直接打开：双击 `index.html` 即可在浏览器中使用。
2) 或开启本地服务器（推荐）：

PowerShell（Windows）：
```bash
python -m http.server 5500
# 或
npx serve -s . --yes
```
打开浏览器访问 `http://localhost:5500`。

建议使用最新版 Chrome/Edge。

## 使用方法
- 从侧栏点击“选择文件”或拖拽 BVH/FBX 到指定区域
- 使用“播放/暂停”“停止”“速度”“循环播放”等控制
- 拖动时间轴进度；查看侧栏文件信息与动作信息
- 加载 FBX 后可切换“蒙皮”显隐

### 键盘快捷键
- 空格：播放/暂停
- Ctrl+S：停止
- ←：后退 1 秒
- →：前进 1 秒

## 示例数据
`assets/` 目录内提供了示例 `*.fbx` 与 `*.bvh` 文件，可直接拖拽体验。

## 依赖
- Three.js `0.152.2`（CDN 加载）
- 本仓库内置 `fflate-0.8.2`
- 自带 `js/BVHLoader.js`、`js/FBXLoader.js`、`js/OrbitControls.js`

## 主要文件结构
```
HumanVis/
  index.html          # 页面入口
  style.css           # 样式
  js/
    main.js           # 统一 UI 与交互逻辑
    visualizer.js     # BVH 可视化核心
    fbx-visualizer.js # FBX 可视化核心
    BVHLoader.js      # BVH 加载器
    FBXLoader.js      # FBX 加载器
    OrbitControls.js  # 轨道控制
  assets/             # 示例数据
  fflate-0.8.2/       # 压缩库（内置）
  LICENSE.md
  README.md
```

## 许可证
本项目采用 MIT 许可证，详见 `LICENSE.md`。

