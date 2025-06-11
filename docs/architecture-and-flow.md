# Anthropic Memory MCP Visualizer - 架构与流程文档

## 项目概述

Anthropic Memory MCP Visualizer 是一个交互式的知识图谱可视化工具，专门用于可视化、调试和分析由 Anthropic Memory MCP 服务器生成的 memory.json 文件中的实体、关系和观察数据。

## 主要功能模块

### 1. 数据解析模块 (Data Parsing)
- **功能**: 解析 memory.json 文件格式
- **支持格式**: 每行一个 JSON 对象（实体或关系）
- **数据类型**: 
  - Entity: `{type: "entity", name, entityType, observations}`
  - Relation: `{type: "relation", from, to, relationType}`
- **错误处理**: 文件格式验证和解析错误提示

### 2. 文件输入模块 (File Input)
- **拖拽上传**: 支持拖拽 JSON 文件到界面
- **文件选择**: 传统文件选择器
- **剪贴板粘贴**: 支持直接粘贴 JSON 内容
- **格式验证**: 自动检测和验证文件格式

### 3. 数据过滤与搜索模块 (Filtering & Search)
- **文本搜索**: 支持按实体名称、类型、观察内容搜索
- **实体类型过滤**: 按实体类型筛选显示
- **关系类型过滤**: 按关系类型筛选显示
- **实时过滤**: 过滤条件变化时实时更新图谱

### 4. 图谱可视化模块 (Graph Visualization)
- **D3.js 力导向图**: 使用 D3.js 实现交互式力导向布局
- **节点渲染**: 实体显示为彩色圆圈，按类型着色
- **边渲染**: 关系显示为带箭头的曲线，包含关系类型标签
- **缩放平移**: 支持鼠标滚轮缩放和拖拽平移
- **节点拖拽**: 支持拖拽节点重新定位

### 5. 交互导航模块 (Navigation)
- **节点选择**: 点击节点查看详细信息
- **历史导航**: 前进/后退按钮浏览选择历史
- **关系导航**: 在详情面板中点击相关实体进行导航
- **中心定位**: 选择节点时自动居中显示

### 6. 详情面板模块 (Details Panel)
- **实体信息**: 显示实体名称、类型、观察列表
- **关系统计**: 显示入站和出站关系数量
- **关系列表**: 分别显示入站和出站关系详情
- **快速导航**: 点击关系中的实体名称快速跳转

### 7. 统计信息模块 (Statistics)
- **实体统计**: 显示实体总数和类型数量
- **关系统计**: 显示关系总数和类型数量
- **实时更新**: 根据过滤条件实时更新统计信息

## 代码执行流程图

### 应用启动流程

```mermaid
flowchart TD
    A[应用启动] --> B[ReactDOM.render]
    B --> C[App 组件加载]
    C --> D[KnowledgeGraphVisualization 组件初始化]
    D --> E[初始化状态变量]
    E --> F{是否有图谱数据?}
    F -->|否| G[显示文件上传界面]
    F -->|是| H[显示图谱可视化界面]
```

### 文件处理流程

```mermaid
flowchart TD
    A[用户操作] --> B{操作类型}
    B -->|文件拖拽| C[handleDrop]
    B -->|文件选择| D[handleFileSelect]
    B -->|剪贴板粘贴| E[handlePaste]
    
    C --> F[文件类型验证]
    D --> F
    E --> G[获取剪贴板内容]
    G --> H[parseMemoryJson]
    
    F --> I{是否为JSON文件?}
    I -->|否| J[显示错误信息]
    I -->|是| K[FileReader.readAsText]
    K --> H[parseMemoryJson]
    
    H --> L[按行分割内容]
    L --> M[遍历每行]
    M --> N{JSON.parse成功?}
    N -->|否| O[记录解析错误]
    N -->|是| P{对象类型?}
    P -->|entity| Q[添加到entities数组]
    P -->|relation| R[添加到relations数组]
    
    Q --> S[更新graphData状态]
    R --> S
    O --> S
    S --> T[计算统计信息]
    T --> U[触发图谱重新渲染]
```

### 图谱渲染流程

```mermaid
flowchart TD
    A[useEffect触发] --> B{检查条件}
    B -->|数据或尺寸无效| C[跳过渲染]
    B -->|条件满足| D[getFilteredData]
    
    D --> E[应用搜索过滤]
    E --> F[应用实体类型过滤]
    F --> G[应用关系类型过滤]
    G --> H[创建节点和链接数组]
    
    H --> I[清除SVG内容]
    I --> J[设置SVG尺寸]
    J --> K[创建缩放行为]
    K --> L[添加箭头标记]
    L --> M[创建力导向仿真]
    
    M --> N[创建链接元素]
    N --> O[创建链接标签]
    O --> P[创建节点组]
    P --> Q[添加圆圈和文本]
    Q --> R[绑定拖拽事件]
    R --> S[绑定点击事件]
    S --> T[启动仿真动画]
```

### 用户交互流程

```mermaid
flowchart TD
    A[用户交互] --> B{交互类型}
    
    B -->|搜索输入| C[setSearchTerm]
    B -->|类型过滤| D[setFilterEntityType/RelationType]
    B -->|节点点击| E[dispatchHistory select]
    B -->|节点拖拽| F[drag事件处理]
    B -->|缩放平移| G[zoom事件处理]
    B -->|导航按钮| H[dispatchHistory back/forward]
    
    C --> I[触发getFilteredData]
    D --> I
    I --> J[重新渲染图谱]
    
    E --> K[更新selectedNode]
    K --> L[显示详情面板]
    L --> M[计算关系统计]
    
    F --> N[更新节点位置]
    N --> O[重启仿真]
    
    G --> P[更新transform]
    P --> Q[重绘图谱元素]
    
    H --> R[更新历史状态]
    R --> S[切换选中节点]
```

### 状态管理流程

```mermaid
stateDiagram-v2
    [*] --> NoData: 应用初始化
    NoData --> Loading: 开始解析文件
    Loading --> Error: 解析失败
    Loading --> DataLoaded: 解析成功
    Error --> Loading: 重新上传文件
    DataLoaded --> Filtering: 应用过滤条件
    Filtering --> DataLoaded: 过滤完成
    DataLoaded --> NodeSelected: 选择节点
    NodeSelected --> DataLoaded: 清除选择
    NodeSelected --> NodeSelected: 导航到其他节点
    DataLoaded --> NoData: 重置可视化
```

## 技术栈详解

### 前端框架
- **React 18**: 使用函数组件和 Hooks
- **TypeScript**: 提供类型安全
- **Vite**: 快速开发构建工具

### 可视化库
- **D3.js v7**: 数据驱动的文档操作
- **力导向布局**: 自动计算节点位置
- **SVG渲染**: 矢量图形确保缩放质量

### 样式框架
- **TailwindCSS**: 实用优先的CSS框架
- **响应式设计**: 支持不同屏幕尺寸

### 状态管理
- **useState**: 组件本地状态
- **useReducer**: 复杂状态逻辑（历史导航）
- **useRef**: DOM引用和D3集成

## 性能优化策略

1. **按需渲染**: 只在数据或过滤条件变化时重新渲染
2. **虚拟化**: 大数据集时的性能优化
3. **防抖处理**: 搜索输入的防抖优化
4. **内存管理**: 及时清理D3事件监听器
5. **懒加载**: 详情面板按需计算关系统计

## 扩展性设计

- **模块化组件**: 易于添加新的可视化类型
- **插件架构**: 支持自定义过滤器和渲染器
- **主题系统**: 可配置的颜色和样式
- **导出功能**: 支持导出图谱为图片或数据