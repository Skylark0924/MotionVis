/**
 * BVH可视化器类
 * 用于加载和显示BVH动作捕捉数据
 */
class BVHVisualizer {
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
    this.boneNames = [];
    this.endSiteNames = [];
    this.objectNames = [];
    this.boneEntries = [];
    this.endSiteEntries = [];
    this.orderedBoneEntries = [];
    // highlight state
    this.highlightMarker = null;
    this.objectHighlightHelper = null;
    this.objectHighlightTarget = null;

    this.initThree();
    this.initUI();
  }

  /**
   * 初始化Three.js场景
   */
  initThree() {
    try {
      console.log("初始化Three.js场景...");

      // 创建场景
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x282c34);

      // 创建相机
      this.camera = new THREE.PerspectiveCamera(
        60,
        this.container.clientWidth / this.container.clientHeight,
        0.1,
        1000
      );
      this.camera.position.set(0, 100, 300);

      // 创建渲染器
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(
        this.container.clientWidth,
        this.container.clientHeight
      );
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.container.appendChild(this.renderer.domElement);

      // 添加轨道控制器
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(0, 100, 0);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.update();

      // 添加灯光
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      this.scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(200, 400, 500);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      this.scene.add(directionalLight);

      // 添加地面网格
      const gridHelper = new THREE.GridHelper(400, 40, 0x888888, 0x444444);
      this.scene.add(gridHelper);

      // 坐标轴辅助
      const axesHelper = new THREE.AxesHelper(50);
      this.scene.add(axesHelper);

      console.log("Three.js场景初始化完成");

      // 开始动画循环
      this.animate();
    } catch (error) {
      console.error("Three.js初始化失败:", error);
      this.updateStatus("Three.js初始化失败: " + error.message);
    }
  }

  /**
   * 初始化UI元素
   */
  initUI() {
    // 不创建自己的UI，使用统一的UI
    console.log("BVH可视化器UI初始化完成");
  }

  /**
   * 创建时间轴控件
   */
  createTimeline() {
    const timelineContainer = document.createElement("div");
    timelineContainer.className = "timeline-container";
    timelineContainer.innerHTML = `
      <div class="timeline-controls">
        <input type="range" id="timeline-slider" min="0" max="100" value="0" step="0.1">
        <span id="time-display">00:00 / 00:00</span>
      </div>
    `;

    // 插入到侧边栏
    const sidebar = document.querySelector(".sidebar");
    const controlsDiv = sidebar.querySelector(".controls");
    sidebar.insertBefore(timelineContainer, controlsDiv.nextSibling);

    // 绑定事件
    this.timelineSlider = document.getElementById("timeline-slider");
    this.timeDisplay = document.getElementById("time-display");

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
    statusDiv.innerHTML = '<div id="status-text">准备就绪</div>';

    const sidebar = document.querySelector(".sidebar");
    sidebar.appendChild(statusDiv);

    this.statusText = document.getElementById("status-text");
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
    requestAnimationFrame(() => this.animate());

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

    // 更新FBX可视化器（如果存在）
    if (window.fbxVisualizer) {
      window.fbxVisualizer.animate();
    }

    if (this.controls) {
      this.controls.update();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
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
   * 高亮指定名称的骨骼
   * @param {string} name - 骨骼名称
   */
  highlightBoneByName(name) {
    if (!name || !this.skeletonRoot) return false;
    let target = null;
    const stack = [this.skeletonRoot];
    while (stack.length) {
      const node = stack.pop();
      if (node && node.name === name) {
        target = node;
        break;
      }
      if (node && node.children) stack.push(...node.children);
    }
    if (!target) return false;
    this._attachHighlightMarker(target);
    return true;
  }

  /**
   * 清除所有高亮
   */
  clearHighlights() {
    if (this.highlightMarker && this.highlightMarker.parent) {
      this.highlightMarker.parent.remove(this.highlightMarker);
    }
    this.highlightMarker = null;
    if (this.objectHighlightHelper) {
      this.scene.remove(this.objectHighlightHelper);
      this.objectHighlightHelper = null;
      this.objectHighlightTarget = null;
    }
  }

  /**
   * 在对象上附着高亮标记
   * @param {THREE.Object3D} object3D - 目标对象
   */
  _attachHighlightMarker(object3D) {
    if (!object3D) return;
    if (this.highlightMarker && this.highlightMarker.parent) {
      this.highlightMarker.parent.remove(this.highlightMarker);
    }
    const geometry = new THREE.SphereGeometry(3, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xffd60a });
    this.highlightMarker = new THREE.Mesh(geometry, material);
    this.highlightMarker.name = "HighlightMarker";
    object3D.add(this.highlightMarker);
    this.highlightMarker.position.set(0, 0, 0);
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
   * 加载BVH数据
   * @param {string} data - BVH文件内容
   */
  loadBVHData(data) {
    try {
      this.updateStatus("正在解析BVH数据...");

      // 移除之前的骨骼
      if (this.skeletonHelper) {
        this.scene.remove(this.skeletonHelper);
      }
      if (this.skeletonRoot) {
        this.scene.remove(this.skeletonRoot);
      }

      // 移除FBX可视化器的模型
      if (window.fbxVisualizer && window.fbxVisualizer.model) {
        this.scene.remove(window.fbxVisualizer.model);
        window.fbxVisualizer.model = null;
      }

      // 创建BVH加载器
      const loader = new BVHLoader();

      // 非常重要：添加调试信息
      console.log("开始解析BVH数据");

      // 解析BVH文件
      const result = loader.parse(data);

      console.log("BVH解析完成");
      console.log("骨骼数量:", result.skeleton.bones.length);
      console.log("动画轨道数量:", result.clip.tracks.length);

      // 非常重要：打印所有骨骼的名称 - 检查是否仍有mixamorig前缀
      console.log("实际骨骼名称:");
      for (let i = 0; i < result.skeleton.bones.length; i++) {
        console.log(`  ${i}: ${result.skeleton.bones[i].name}`);
      }

      // 非常重要：打印所有动画轨道的名称
      console.log("实际动画轨道名称:");
      for (let i = 0; i < result.clip.tracks.length; i++) {
        console.log(`  ${i}: ${result.clip.tracks[i].name}`);
      }

      // 收集骨骼与物体名称（区分 End Site）
      const allBones = result.skeleton.bones;
      const isEndSite = (name) =>
        /\b(end\s*site|site$|end\s*$)/i.test(name || "");
      this.boneNames = [];
      this.endSiteNames = [];
      this.boneEntries = [];
      this.endSiteEntries = [];

      const detectSide = (name) => {
        const n = (name || "").toLowerCase();
        if (/left|^l[^a-z]?|\.l$|_l$|mixamorig:Left/i.test(name)) return "Left";
        if (/right|^r[^a-z]?|\.r$|_r$|mixamorig:Right/i.test(name))
          return "Right";
        return "";
      };
      const detectFinger = (name) => {
        const n = (name || "").toLowerCase();
        if (/thumb/.test(n)) return "Thumb";
        if (/index/.test(n)) return "Index";
        if (/middle/.test(n)) return "Middle";
        if (/ring/.test(n)) return "Ring";
        if (/pinky|little/.test(n)) return "Pinky";
        return "";
      };
      const buildEndSiteLabel = (bone) => {
        // ascend ancestors to guess side/finger
        let side = "";
        let finger = "";
        let ancestorName = "";
        let p = bone.parent;
        while (p) {
          if (!side) side = detectSide(p.name);
          if (!finger) finger = detectFinger(p.name);
          if (!ancestorName && p.name && !isEndSite(p.name)) {
            ancestorName = p.name;
          }
          if (side && finger) break;
          p = p.parent;
        }
        const prefix =
          [side, finger].filter(Boolean).join(" ") || ancestorName || "Bone";
        return `${prefix} EndSite`;
      };

      for (let i = 0; i < allBones.length; i++) {
        const bone = allBones[i];
        const name = bone.name || "(未命名)";
        const entry = { label: name, uuid: bone.uuid };
        if (isEndSite(name)) {
          this.endSiteNames.push(name);
          this.endSiteEntries.push({
            label: buildEndSiteLabel(bone),
            uuid: bone.uuid,
          });
        } else {
          this.boneNames.push(name);
          this.boneEntries.push(entry);
        }
      }

      // 构建按 BVH 原始顺序的合并列表（骨骼 + End Site）
      this.orderedBoneEntries = [];
      for (let i = 0; i < allBones.length; i++) {
        const bone = allBones[i];
        const raw = bone.name || "(未命名)";
        const label = isEndSite(raw) ? buildEndSiteLabel(bone) : raw;
        this.orderedBoneEntries.push({ index: i + 1, label, uuid: bone.uuid });
      }
      // BVH 一般不包含网格物体，这里保持为空
      this.objectNames = [];

      // 存储动作信息（关节数不含 End Site）
      this.motionInfo = {
        frames: result.clip.tracks[0] ? result.clip.tracks[0].times.length : 0,
        frameTime: result.clip.frameRate ? 1 / result.clip.frameRate : 0.033,
        duration: result.clip.duration,
        joints: this.boneNames.length,
      };

      this.duration = result.clip.duration;

      // 添加骨骼根节点到场景
      this.skeletonRoot = result.skeleton.bones[0];
      this.scene.add(this.skeletonRoot);

      // 添加骨骼可视化
      this.skeletonHelper = new THREE.SkeletonHelper(this.skeletonRoot);
      this.skeletonHelper.material.linewidth = 2;
      this.skeletonHelper.material.color.setHex(0x00ff00);
      this.scene.add(this.skeletonHelper);

      // 尝试使用一个更简单的方法解决骨骼名称和轨道名称不匹配的问题
      // 方法：将所有动画轨道的目标设置为根骨骼
      // 这不会播放正确的动画，但至少可以确认BVH数据有效

      const rootTracks = [];
      const rootName = this.skeletonRoot.name;

      console.log(`尝试创建作用于根骨骼的轨道: ${rootName}`);

      for (let i = 0; i < result.clip.tracks.length; i++) {
        const track = result.clip.tracks[i];
        const property = track.name.split(".")[1]; // "position" 或 "quaternion"

        // 创建一个只作用于根骨骼的新轨道
        if (property === "position") {
          rootTracks.push(
            new THREE.VectorKeyframeTrack(
              `${rootName}.position`,
              track.times,
              track.values
            )
          );
        } else if (property === "quaternion") {
          rootTracks.push(
            new THREE.QuaternionKeyframeTrack(
              `${rootName}.quaternion`,
              track.times,
              track.values
            )
          );
        }
      }

      // 创建一个简单的动画片段，只作用于根骨骼
      const rootClip = new THREE.AnimationClip(
        "root-animation",
        result.clip.duration,
        rootTracks
      );

      // 创建动画混合器
      this.mixer = new THREE.AnimationMixer(this.skeletonRoot);

      // 首先尝试直接使用原始动画片段
      try {
        this.action = this.mixer.clipAction(result.clip);
        this.action.setLoop(THREE.LoopRepeat);
        this.action.play();
        console.log("使用原始动画片段");
      } catch (e) {
        console.warn("原始动画片段失败，尝试使用根骨骼动画:", e.message);

        // 如果失败，使用根骨骼动画
        this.action = this.mixer.clipAction(rootClip);
        this.action.setLoop(THREE.LoopRepeat);
        this.action.play();
        console.log("使用根骨骼动画片段");
      }

      console.log("动画混合器创建完成");

      // 默认暂停动画
      this.playing = false;
      this.currentTime = 0;
      this.updateTimeline();

      // 强制更新一次混合器以显示初始状态
      this.mixer.update(0);

      // 自动调整相机以适应骨骼模型
      this.fitCameraToSkeleton(result.skeleton);

      this.updateStatus("BVH数据加载成功");

      // 更新动作信息面板
      if (window.updateMotionInfo) {
        window.updateMotionInfo(this.getMotionInfo());
      }
    } catch (error) {
      console.error("BVH数据加载失败:", error);
      this.updateStatus("BVH数据加载失败: " + error.message);
    }
  }

  /**
   * 自动调整相机以适应骨骼模型
   * @param {THREE.Skeleton} skeleton - 骨骼对象
   */
  fitCameraToSkeleton(skeleton) {
    // 计算骨骼的边界框
    const box = new THREE.Box3();

    skeleton.bones.forEach((bone) => {
      box.expandByPoint(bone.getWorldPosition(new THREE.Vector3()));
    });

    const center = new THREE.Vector3();
    box.getCenter(center);

    const size = new THREE.Vector3();
    box.getSize(size);

    // 根据骨骼大小调整相机位置
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 3;

    this.camera.position.set(center.x, center.z + distance, center.y);
    this.controls.target.copy(center);
    this.controls.update();
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
   * 返回包含唯一标识的骨骼条目
   * @returns {{label:string, uuid:string}[]}
   */
  getBoneEntries() {
    return Array.isArray(this.boneEntries) ? this.boneEntries : [];
  }

  /**
   * 获取 End Site 名称列表
   * @returns {string[]} End Site 名称数组
   */
  getEndSiteNames() {
    return Array.isArray(this.endSiteNames) ? this.endSiteNames : [];
  }

  /**
   * 返回包含唯一标识的 End Site 条目
   * @returns {{label:string, uuid:string}[]}
   */
  getEndSiteEntries() {
    return Array.isArray(this.endSiteEntries) ? this.endSiteEntries : [];
  }

  /**
   * 获取按文件原始顺序编号的骨骼/End Site 合并列表
   * @returns {{index:number,label:string,uuid:string}[]}
   */
  getOrderedBoneEntries() {
    return Array.isArray(this.orderedBoneEntries)
      ? this.orderedBoneEntries
      : [];
  }

  /**
   * 通过UUID高亮骨骼
   * @param {string} uuid - 目标骨骼UUID
   */
  highlightBoneByUUID(uuid) {
    if (!uuid) return false;
    const target = this.scene.getObjectByProperty("uuid", uuid);
    if (!target) return false;
    this._attachHighlightMarker(target);
    return true;
  }

  /**
   * 获取物体名称列表
   * @returns {string[]} 物体名称数组
   */
  getObjectNames() {
    return Array.isArray(this.objectNames) ? this.objectNames : [];
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
}
