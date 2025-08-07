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

          // 获取动画信息
          if (object.animations && object.animations.length > 0) {
            const animation = object.animations[0];
            this.duration = animation.duration;

            // 创建动画混合器
            this.mixer = new THREE.AnimationMixer(object);
            this.action = this.mixer.clipAction(animation);
            this.action.setLoop(THREE.LoopRepeat);
            this.action.play();

            // 存储动作信息
            this.motionInfo = {
              frames: animation.tracks[0] ? animation.tracks[0].times.length : 0,
              frameTime: animation.duration > 0 ? animation.duration / (animation.tracks[0] ? animation.tracks[0].times.length : 1) : 0.033,
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
          
          // 清理URL
          URL.revokeObjectURL(url);
        },
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
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
    box.setFromObject(object);

    const center = new THREE.Vector3();
    box.getCenter(center);

    const size = new THREE.Vector3();
    box.getSize(size);

    // 根据模型大小调整相机位置
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 3;

    this.camera.position.set(center.x, center.y + distance, center.z + distance);
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
