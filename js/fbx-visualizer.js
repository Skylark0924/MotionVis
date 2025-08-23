/**
 * FBX可视化器类
 * 用于加载和显示FBX动作捕捉数据
 */
class FBXVisualizer {
  /**
   * 构造函数
   * @param {HTMLElement} container - 容器元素
   */
  constructor(container) {
    this.container = container;
    this.playing = false;
    this.playbackSpeed = 1.0;
    this.motionInfo = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.action = null;
    this.loop = true;
    this.currentTime = 0;
    this.duration = 0;
    this.model = null;
    this.boneNames = [];
    this.objectNames = [];
    // highlight state
    this.objectHighlightHelper = null;
    this.objectHighlightTarget = null;
    // skin visibility & helpers
    this.skinVisible = true;
    this.skeletonHelper = null;
    // skin visibility
    this.skinVisible = true;
    // vertex overlays for non-skinned meshes when skin is hidden
    this.vertexOverlays = [];
    // coordinate system and ground grid
    this.coordinateSystem = null;
    this.axesVisible = true;
    this.groundGrid = null;
    this.groundVisible = true;

    this.initThree();
    this.initUI();
  }

  /**
   * 初始化Three.js场景
   */
  initThree() {
    try {
      console.log("初始化FBX可视化器...");

      // 获取现有的渲染器和场景
      const existingVisualizer = window.bvhVisualizer;
      if (existingVisualizer) {
        this.scene = existingVisualizer.scene;
        this.camera = existingVisualizer.camera;
        this.renderer = existingVisualizer.renderer;
        this.controls = existingVisualizer.controls;
        console.log("复用现有的Three.js场景");
      } else {
        console.error("BVH可视化器未找到");
        this.updateStatus("BVH可视化器未找到");
        return;
      }

      console.log("FBX可视化器初始化完成");

      // Bind to existing helpers in the shared scene (created by BVH visualizer)
      this._bindExistingHelpers();
    } catch (error) {
      console.error("FBX可视化器初始化失败:", error);
      this.updateStatus("FBX可视化器初始化失败: " + error.message);
    }
  }

  /**
   * 初始化UI元素
   */
  initUI() {
    // 不创建自己的UI，使用统一的UI
    console.log("FBX可视化器UI初始化完成");
  }

  /**
   * 创建时间轴控件
   */
  createTimeline() {
    const timelineContainer = document.createElement("div");
    timelineContainer.className = "timeline-container";
    timelineContainer.innerHTML = `
      <div class="timeline-controls">
        <input type="range" id="fbx-timeline-slider" min="0" max="100" value="0" step="0.1">
        <span id="fbx-time-display">00:00 / 00:00</span>
      </div>
    `;

    // 插入到侧边栏
    const sidebar = document.querySelector(".sidebar");
    const controlsDiv = sidebar.querySelector(".controls");
    sidebar.insertBefore(timelineContainer, controlsDiv.nextSibling);

    // 绑定事件
    this.timelineSlider = document.getElementById("fbx-timeline-slider");
    this.timeDisplay = document.getElementById("fbx-time-display");

    this.timelineSlider.addEventListener("input", (e) => {
      const progress = parseFloat(e.target.value) / 100;
      this.seekTo(progress * this.duration);
    });
  }

  /**
   * 创建状态显示
   */
  createStatusDisplay() {
    const statusDiv = document.createElement("div");
    statusDiv.className = "status-display";
    statusDiv.innerHTML = '<div id="fbx-status-text">准备就绪</div>';

    const sidebar = document.querySelector(".sidebar");
    sidebar.appendChild(statusDiv);

    this.statusText = document.getElementById("fbx-status-text");
  }

  /**
   * 更新状态显示
   * @param {string} message - 状态消息
   */
  updateStatus(message) {
    if (window.updateUnifiedStatus) {
      window.updateUnifiedStatus(message);
    }
  }

  /**
   * 动画循环
   */
  animate() {
    const delta = this.clock.getDelta();

    // 更新动画混合器
    if (this.mixer) {
      if (this.playing) {
        this.mixer.update(delta * this.playbackSpeed);
        if (this.action) {
          this.currentTime = this.action.time;
          this.updateTimeline();
        }
      } else {
        // 即使暂停也要更新混合器以保持当前状态
        this.mixer.update(0);
      }
    }

    // 更新物体高亮边界框位置
    this._updateBoundingBoxHighlight();

    // 更新顶点覆盖以跟随源对象
    this._updateVertexOverlays();
  }

  /**
   * 更新时间轴显示
   */
  updateTimeline() {
    if (window.updateUnifiedUI) {
      window.updateUnifiedUI();
    }
  }

  /**
   * 格式化时间显示
   * @param {number} time - 时间（秒）
   * @returns {string} 格式化的时间字符串
   */
  formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * 跳转到指定时间
   * @param {number} time - 目标时间（秒）
   */
  seekTo(time) {
    if (this.action && this.duration > 0) {
      this.currentTime = Math.max(0, Math.min(time, this.duration));
      this.action.time = this.currentTime;
      this.updateTimeline();
    }
  }

  /**
   * 加载FBX文件
   * @param {File} file - FBX文件对象
   */
  loadFBXFile(file) {
    try {
      this.updateStatus("正在加载FBX文件...");

      // 移除之前的模型和骨骼
      if (this.model) {
        this.scene.remove(this.model);
        this.model = null;
      }
      if (this.skeletonHelper) {
        this.scene.remove(this.skeletonHelper);
        this.skeletonHelper = null;
      }

      // 移除BVH可视化器的骨骼
      if (window.bvhVisualizer) {
        if (window.bvhVisualizer.skeletonHelper) {
          this.scene.remove(window.bvhVisualizer.skeletonHelper);
        }
        if (window.bvhVisualizer.skeletonRoot) {
          this.scene.remove(window.bvhVisualizer.skeletonRoot);
        }
      }

      // 创建FBX加载器
      const loader = new THREE.FBXLoader();

      // 创建文件URL
      const url = URL.createObjectURL(file);

      // 加载FBX文件
      loader.load(
        url,
        (object) => {
          console.log("FBX文件加载成功:", object);

          // 存储模型
          this.model = object;
          this.scene.add(object);
          // 确保世界矩阵最新，避免包围盒/尺寸异常
          try {
            object.updateMatrixWorld(true);
          } catch (e) {
            console.warn("updateMatrixWorld 失败:", e);
          }
          // 应用当前蒙皮可见性与骨架可视
          this.setSkinVisible(this.skinVisible);

          // 应用当前蒙皮可见性
          this.setSkinVisible(this.skinVisible);

          // 获取动画信息
          if (object.animations && object.animations.length > 0) {
            const animation = object.animations[0];
            this.duration = animation.duration;

            // 创建动画混合器
            this.mixer = new THREE.AnimationMixer(object);
            this.action = this.mixer.clipAction(animation);
            this.action.setLoop(this.loop ? THREE.LoopRepeat : THREE.LoopOnce);
            this.action.clampWhenFinished = true;
            this.action.play();

            // 存储动作信息
            this.motionInfo = {
              frames: animation.tracks[0]
                ? animation.tracks[0].times.length
                : 0,
              frameTime:
                animation.duration > 0
                  ? animation.duration /
                    (animation.tracks[0] ? animation.tracks[0].times.length : 1)
                  : 0.033,
              duration: animation.duration,
              joints: this.countJoints(object),
            };

            console.log("动画信息:", this.motionInfo);
          } else {
            console.warn("FBX文件没有动画数据");
            this.motionInfo = {
              frames: 0,
              frameTime: 0,
              duration: 0,
              joints: this.countJoints(object),
            };
          }

          // 收集骨骼（按遍历顺序，基于 uuid 与 名称 双重去重）
          this.boneNames = [];
          this.boneEntries = [];
          this.orderedBoneEntries = [];
          const uuidSeen = new Set();
          const nameSeen = new Set();
          object.traverse((child) => {
            if (!child.isBone) return;
            const uuid = child.uuid;
            const rawName = child.name || "(未命名)";
            const nameKey = rawName.toLowerCase();
            if (uuidSeen.has(uuid) || nameSeen.has(nameKey)) return;
            uuidSeen.add(uuid);
            nameSeen.add(nameKey);
            const label = rawName;
            this.boneNames.push(label);
            this.boneEntries.push({ label, uuid });
            this.orderedBoneEntries.push({
              index: this.orderedBoneEntries.length + 1,
              label,
              uuid,
            });
          });
          // 回退：如果未找到 Bone 节点，则尝试从 SkinnedMesh 的 skeleton 中提取
          if (this.boneEntries.length === 0) {
            const skinnedBones = new Map();
            object.traverse((child) => {
              if (
                child.isSkinnedMesh &&
                child.skeleton &&
                child.skeleton.bones
              ) {
                child.skeleton.bones.forEach((b) => {
                  if (!b) return;
                  const uuid = b.uuid;
                  const rawName = b.name || "(未命名)";
                  const nameKey = rawName.toLowerCase();
                  if (skinnedBones.has(uuid) || nameSeen.has(nameKey)) return;
                  skinnedBones.set(uuid, rawName);
                });
              }
            });
            let index = 1;
            for (const [uuid, rawName] of skinnedBones.entries()) {
              const label = rawName;
              this.boneNames.push(label);
              this.boneEntries.push({ label, uuid });
              this.orderedBoneEntries.push({ index: index++, label, uuid });
            }
          }

          // 收集物体名称（可见网格/组）
          this.objectNames = [];
          object.traverse((child) => {
            if (child.isMesh || child.type === "Group") {
              this.objectNames.push(child.name || child.type);
            }
          });

          // 自动调整相机以适应模型
          this.fitCameraToModel(object);

          // 默认暂停动画
          this.playing = false;
          this.currentTime = 0;
          this.updateTimeline();

          // 强制更新一次混合器以显示初始状态
          if (this.mixer) {
            this.mixer.update(0);
          }

          this.updateStatus("FBX文件加载成功");

          // 更新动作信息面板
          if (window.updateMotionInfo) {
            window.updateMotionInfo(this.getMotionInfo());
          }

          // 清理URL
          URL.revokeObjectURL(url);
        },
          (progress) => {
            let percent = 0;
            if (
              progress &&
              typeof progress.loaded === "number" &&
              progress.total
            ) {
              percent = (progress.loaded / progress.total) * 100;
            }
            this.updateStatus(`加载中... ${percent.toFixed(1)}%`);
          },
        (error) => {
          console.error("FBX文件加载失败:", error);
          this.updateStatus("FBX文件加载失败: " + error.message);
          URL.revokeObjectURL(url);
        }
      );
    } catch (error) {
      console.error("FBX文件加载失败:", error);
      this.updateStatus("FBX文件加载失败: " + error.message);
    }
  }

  /**
   * 计算模型中的关节数量
   * @param {THREE.Object3D} object - 3D对象
   * @returns {number} 关节数量
   */
  countJoints(object) {
    let count = 0;
    object.traverse((child) => {
      if (child.isBone) {
        count++;
      }
    });
    return count;
  }

  /**
   * 自动调整相机以适应模型
   * @param {THREE.Object3D} object - 3D对象
   */
  fitCameraToModel(object) {
    // 计算模型的边界框
    const box = new THREE.Box3();
    try {
      object.updateMatrixWorld(true);
    } catch (e) {
      console.warn("updateMatrixWorld 失败:", e);
    }
    box.setFromObject(object);

    const center = new THREE.Vector3();
    box.getCenter(center);

    const size = new THREE.Vector3();
    box.getSize(size);

    // 根据模型大小调整相机位置与裁剪面
    let maxDim = Math.max(size.x, size.y, size.z);
    if (!isFinite(maxDim) || maxDim <= 0) {
      maxDim = 100; // 合理缺省
    }
    const distance = maxDim * 3;

    const offset = new THREE.Vector3(0.5, 0.7, 0.7)
      .normalize()
      .multiplyScalar(distance);
    this.camera.position.copy(center.clone().add(offset));

    // 调整裁剪面，避免过远/过近导致的裁剪或深度失真
    const near = Math.max(0.01, distance / 100);
    const far = Math.max(near * 1000, distance * 10);
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();

    if (this.controls) {
      this.controls.target.copy(center);
      this.controls.maxDistance = far * 0.9;
      this.controls.minDistance = Math.min(10, near * 10);
      this.controls.update();
    }
  }

  /**
   * 播放动画
   */
  play() {
    if (this.action) {
      this.playing = true;
      this.clock.start();
      this.updateStatus("播放中");
    }
  }

  /**
   * 暂停动画
   */
  pause() {
    this.playing = false;
    this.updateStatus("已暂停");
  }

  /**
   * 停止动画
   */
  stop() {
    if (this.action) {
      this.playing = false;
      this.currentTime = 0;
      this.action.time = 0;
      this.updateTimeline();
      this.updateStatus("已停止");
    }
  }

  /**
   * 检查是否正在播放
   * @returns {boolean} 是否正在播放
   */
  isPlaying() {
    return this.playing;
  }

  /**
   * 设置播放速度
   * @param {number} speed - 播放速度倍数
   */
  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
  }

  /**
   * 设置循环播放
   * @param {boolean} loop - 是否循环播放
   */
  setLoop(loop) {
    this.loop = loop;
    if (this.action) {
      this.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
    }
  }

  /**
   * 获取动作信息
   * @returns {Object|null} 动作信息对象
   */
  getMotionInfo() {
    return this.motionInfo;
  }

  /**
   * 获取骨骼名称列表
   * @returns {string[]} 骨骼名称数组
   */
  getBoneNames() {
    return Array.isArray(this.boneNames) ? this.boneNames : [];
  }

  /**
   * 获取包含唯一标识的骨骼条目
   * @returns {{label:string, uuid:string}[]}
   */
  getBoneEntries() {
    return Array.isArray(this.boneEntries) ? this.boneEntries : [];
  }

  /**
   * 获取按遍历顺序编号的骨骼条目
   * @returns {{index:number,label:string,uuid:string}[]}
   */
  getOrderedBoneEntries() {
    return Array.isArray(this.orderedBoneEntries)
      ? this.orderedBoneEntries
      : [];
  }

  /**
   * 获取物体名称列表
   * @returns {string[]} 物体名称数组
   */
  getObjectNames() {
    return Array.isArray(this.objectNames) ? this.objectNames : [];
  }

  /**
   * 设置蒙皮可见性（SMPL/网格）
   * @param {boolean} visible - 是否可见
   */
  setSkinVisible(visible) {
    this.skinVisible = !!visible;
    if (!this.model) return;
    this.model.traverse((child) => {
      // 只隐藏/显示蒙皮网格，保留其他物体
      if (child.isSkinnedMesh) {
        child.visible = this.skinVisible;
      }
    });

    // 切换骨架可视化：隐藏蒙皮时显示骨架，显示蒙皮时移除骨架
    if (!this.skinVisible) {
      if (!this.skeletonHelper) {
        // 尝试找到含有骨架的根对象
        let skinnedRoot = this.model;
        this.skeletonHelper = new THREE.SkeletonHelper(skinnedRoot);
        this.skeletonHelper.material.linewidth = 6;
        this.skeletonHelper.material.color.setHex(0x00ff00);
        this.scene.add(this.skeletonHelper);
      }

      // 隐藏非蒙皮网格并显示为顶点
      if (!this.vertexOverlays || this.vertexOverlays.length === 0) {
        this._createVertexOverlays();
      }
      this._setNonSkinnedMeshesVisible(false);
    } else if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
      this.skeletonHelper = null;

      // 恢复非蒙皮网格可见并移除顶点覆盖
      this._setNonSkinnedMeshesVisible(true);
      this._removeVertexOverlays();
    }
  }

  /**
   * Create vertex overlays (THREE.Points) and edge overlays (THREE.LineSegments) for non-skinned meshes when skin is hidden.
   * :return: void
   */
  _createVertexOverlays() {
    if (!this.model) return;
    this.vertexOverlays = [];
    // Traverse model and create Points and LineSegments overlays for each non-skinned mesh
    this.model.traverse((child) => {
      if (child.isMesh && !child.isSkinnedMesh && child.geometry) {
        try {
          // Ensure world matrix is up to date
          child.updateWorldMatrix(true, false);

                    // Create vertex points overlay
          const pointsMaterial = new THREE.PointsMaterial({
            size: 0.002,
            sizeAttenuation: true,
            color: this._getVertexColorForTheme(),
          });
          const points = new THREE.Points(child.geometry, pointsMaterial);
          points.name = "VertexOverlay";
          points.matrixAutoUpdate = false;
          points.matrix.copy(child.matrixWorld);
          
          // Create edge lines overlay
          const edgesGeometry = new THREE.EdgesGeometry(child.geometry);
          const linesMaterial = new THREE.LineBasicMaterial({
            color: this._getEdgeColorForTheme(),
            linewidth: 1,
          });
          const lines = new THREE.LineSegments(edgesGeometry, linesMaterial);
          lines.name = "EdgeOverlay";
          lines.matrixAutoUpdate = false;
          lines.matrix.copy(child.matrixWorld);

          // Add both overlays to scene root to avoid being hidden with the source mesh
          this.scene.add(points);
          this.scene.add(lines);
          this.vertexOverlays.push({ points, lines, source: child });
        } catch (e) {
          console.warn("Failed to create vertex/edge overlay:", e);
        }
      }
    });
  }

  /**
   * Remove all vertex and edge overlays from the scene.
   * :return: void
   */
  _removeVertexOverlays() {
    if (!this.vertexOverlays) return;
    for (const item of this.vertexOverlays) {
      if (item && item.points && item.points.parent) {
        this.scene.remove(item.points);
      }
      if (item && item.lines && item.lines.parent) {
        this.scene.remove(item.lines);
      }
    }
    this.vertexOverlays = [];
  }

  /**
   * Update vertex and edge overlays to follow their source meshes transforms.
   * :return: void
   */
  _updateVertexOverlays() {
    if (!this.vertexOverlays || this.vertexOverlays.length === 0) return;
    for (const item of this.vertexOverlays) {
      const source = item.source;
      const points = item.points;
      const lines = item.lines;
      if (!source || !points || !lines) continue;
      try {
        source.updateWorldMatrix(true, false);
        points.matrix.copy(source.matrixWorld);
        lines.matrix.copy(source.matrixWorld);
      } catch (e) {
        // ignore per-frame errors
      }
    }
  }

  /**
   * Set visibility for all non-skinned meshes in current model.
   * :param visible, boolean: desired visibility state
   * :return: void
   */
  _setNonSkinnedMeshesVisible(visible) {
    if (!this.model) return;
    this.model.traverse((child) => {
      if (child.isMesh && !child.isSkinnedMesh) {
        child.visible = !!visible;
      }
    });
  }

  /**
   * 高亮指定名称的物体
   * @param {string} name - 物体名称
   */
  highlightObjectByName(name) {
    if (!name || !this.model) return false;
    let target = null;
    this.model.traverse((child) => {
      if (
        !target &&
        (child.isMesh || child.type === "Group") &&
        child.name === name
      ) {
        target = child;
      }
    });
    if (!target) return false;

    // 清理旧的高亮
    this.clearHighlights();

    // 创建跟随运动的边界框高亮
    this._createBoundingBoxHighlight(target);
    return true;
  }

  /**
   * 创建跟随运动的边界框高亮
   * @param {THREE.Object3D} object3D - 目标对象
   */
  _createBoundingBoxHighlight(object3D) {
    if (!object3D) return;

    // 清理旧标记
    if (this.objectHighlightHelper) {
      this.scene.remove(this.objectHighlightHelper);
    }

    // 创建边界框辅助对象
    const box = new THREE.Box3().setFromObject(object3D);
    this.objectHighlightHelper = new THREE.Box3Helper(box, 0xffd60a);
    this.objectHighlightHelper.name = "ObjectBoundingBoxHighlight";

    // 将边界框添加到场景中
    this.scene.add(this.objectHighlightHelper);
    this.objectHighlightTarget = object3D;
  }

  /**
   * 更新边界框高亮位置
   */
  _updateBoundingBoxHighlight() {
    if (this.objectHighlightHelper && this.objectHighlightTarget) {
      // 重新计算目标对象的边界框
      const box = new THREE.Box3().setFromObject(this.objectHighlightTarget);

      // 更新边界框辅助对象的位置和大小
      this.objectHighlightHelper.box.copy(box);
    }
  }

  /** 清除高亮 */
  clearHighlights() {
    if (this.objectHighlightHelper) {
      this.scene.remove(this.objectHighlightHelper);
    }
    this.objectHighlightHelper = null;
    this.objectHighlightTarget = null;
  }

  /**
   * 调整窗口大小
   */
  resize() {
    if (this.camera && this.renderer) {
      this.camera.aspect =
        this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(
        this.container.clientWidth,
        this.container.clientHeight
      );
    }
  }

  /**
   * Bind to existing coordinate system and ground grid helpers in the shared scene.
   * :return: void
   */
  _bindExistingHelpers() {
    if (!this.scene) return;

    // Find existing helpers by type
    let axesHelper = null;
    let gridHelper = null;
    this.scene.traverse((obj) => {
      if (!axesHelper && obj.type === "AxesHelper") {
        axesHelper = obj;
      }
      if (!gridHelper && obj.type === "GridHelper") {
        gridHelper = obj;
      }
    });

    // Bind to existing helpers
    this.coordinateSystem = axesHelper;
    this.groundGrid = gridHelper;

    // Update existing grid colors to match theme
    if (this.groundGrid) {
      this._updateGroundGridColors();
    }
  }

  /**
   * Update ground grid colors to match current theme.
   * :return: void
   */
  _updateGroundGridColors() {
    if (!this.groundGrid) return;
    const { centerColor, gridColor } = this._getGridColorsForTheme();
    const mat = this.groundGrid.material;
    if (Array.isArray(mat)) {
      if (mat[0] && mat[0].color) mat[0].color.setHex(gridColor);
      if (mat[1] && mat[1].color) mat[1].color.setHex(centerColor);
    } else if (mat && mat.color) {
      mat.color.setHex(gridColor);
    }
  }

  /**
   * Compute grid colors based on current theme.
   * :return: {centerColor:number, gridColor:number}
   */
  _getGridColorsForTheme() {
    const isDark = document.documentElement.classList.contains("theme-dark");
    if (isDark) {
      return { centerColor: 0x444444, gridColor: 0x2a2a2a };
    }
    return { centerColor: 0x888888, gridColor: 0xcccccc };
  }

  /**
   * Toggle ground grid visibility.
   * :param visible, boolean: desired visibility
   * :return: void
   */
  setGroundVisible(visible) {
    this.groundVisible = !!visible;
    if (this.groundGrid) {
      this.groundGrid.visible = this.groundVisible;
    }
  }

  /**
   * Toggle axes helper visibility.
   * :param visible, boolean: desired visibility
   * :return: void
   */
  setAxesVisible(visible) {
    this.axesVisible = !!visible;
    if (this.coordinateSystem) {
      this.coordinateSystem.visible = this.axesVisible;
    }
  }

  /**
   * Get ground grid visibility.
   * :return: boolean
   */
  isGroundVisible() {
    return !!this.groundVisible;
  }

  /**
   * Get axes helper visibility.
   * :return: boolean
   */
  isAxesVisible() {
    return !!this.axesVisible;
  }

  /**
   * Refresh theme-driven visuals.
   * :return: void
   */
  refreshTheme() {
    this._updateGroundGridColors();
    this._updateBackgroundColor();
    this._updateVertexOverlayColors();
  }

  /**
   * Update background color based on current theme.
   * :return: void
   */
  _updateBackgroundColor() {
    if (!this.scene) return;
    const isDark = document.documentElement.classList.contains("theme-dark");
    if (isDark) {
      this.scene.background = new THREE.Color(0x282c34);
    } else {
      this.scene.background = new THREE.Color(0xf0f0f0);
    }
  }

  /**
   * Get vertex color based on current theme.
   * :return: number
   */
  _getVertexColorForTheme() {
    const isDark = document.documentElement.classList.contains("theme-dark");
    if (isDark) {
      return 0xffffff; // 深色模式：白色顶点
    } else {
      return 0x000000; // 浅色模式：黑色顶点
    }
  }

  /**
   * Get edge color based on current theme.
   * :return: number
   */
  _getEdgeColorForTheme() {
    const isDark = document.documentElement.classList.contains("theme-dark");
    if (isDark) {
      return 0x00ffff; // 深色模式：青色边线
    } else {
      return 0x333333; // 浅色模式：深灰色边线
    }
  }

  /**
   * Update colors of existing vertex overlays to match current theme.
   * :return: void
   */
  _updateVertexOverlayColors() {
    if (!this.vertexOverlays || this.vertexOverlays.length === 0) return;
    
    const vertexColor = this._getVertexColorForTheme();
    const edgeColor = this._getEdgeColorForTheme();
    
    for (const item of this.vertexOverlays) {
      if (item.points && item.points.material) {
        item.points.material.color.setHex(vertexColor);
      }
      if (item.lines && item.lines.material) {
        item.lines.material.color.setHex(edgeColor);
      }
    }
  }
}
