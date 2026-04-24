# 学霸帝AI

基于 Qwen2.5-VL-3B 的macOS本地智能助手，支持中文 OCR 识别、图片理解和自然对话。模型完全运行在本地，无需联网，保护隐私。

## 技术栈

- **推理引擎**: llama.cpp (llama-server) — CPU-only，无需 GPU
- **视觉模型**: Qwen2.5-VL-3B-Instruct-Q4_K_M (GGUF)
- **OCR 识别**: macOS Vision 框架 (VNRecognizeTextRequest) — 支持中英混排
- **桌面框架**: Electron 33

## 首次使用

### 1. 安装依赖

```bash
brew install llama.cpp
npm install
```

### 2. 下载模型

从 ModelScope 下载两个 GGUF 文件到 `~/.xuebadi-ai/models/`：

- **主模型** (~1.9GB): [Qwen2.5-VL-3B-Instruct-q4_k_m.gguf](https://www.modelscope.cn/models/aplux/Qwen2.5-VL-3B-Instruct-q4_k_m/resolve/master/Qwen2.5-VL-3B-Instruct-q4_k_m.gguf)
- **视觉投影器** (~1.3GB): [Qwen2.5-VL-3B-Instruct.mmproj-fp16.gguf](https://www.modelscope.cn/models/aplux/Qwen2.5-VL-3B-Instruct-q4_k_m/resolve/master/Qwen2.5-VL-3B-Instruct.mmproj-fp16.gguf)

```bash
mkdir -p ~/.xuebadi-ai/models
# 将下载的两个 .gguf 文件放入此目录
```

### 3. 编译 OCR 工具

```bash
swiftc -o ocr-helper/ocr-helper ocr-helper/main.swift -framework Vision
```

### 4. 运行

```bash
npm start
```

## 打包 DMG

```bash
# 将 llama-server 复制到 bin/ 目录
cp $(which llama-server) bin/
npx electron-builder --mac dmg --x64
```

产物在 `dist/学霸帝AI-1.0.0.dmg`。

> 未签名的 DMG 需右键 → 打开，绕过 Gatekeeper。

## 项目结构

```
├── main.js              # Electron 主进程
├── src/
│   ├── index.html       # UI 界面
│   └── preload.js       # 安全桥接
├── ocr-helper/
│   └── main.swift       # Vision OCR 工具源码
├── bin/                 # 打包用二进制 (gitignore)
└── package.json
```

## License

MIT
