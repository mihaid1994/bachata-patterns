document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const selectFileBtn = document.getElementById("selectFileBtn");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const markPatternBtn = document.getElementById("markPatternBtn");
  const undoPatternBtn = document.getElementById("undoPatternBtn"); // Добавляем кнопку отмены

  // Контейнер для ярлыков паттернов
  const patternsContainer = document.getElementById("patternsContainer");

  // Счётчик битов
  const beatCounter = document.getElementById("beatCounter");
  const beats = beatCounter.querySelectorAll(".beat");

  // BPM
  const bpmInput = document.getElementById("bpmInput");
  const setBpmBtn = document.getElementById("setBpmBtn");

  // Отображение времени
  const currentTimeDisplay = document.getElementById("currentTime");
  const totalTimeDisplay = document.getElementById("totalTime");

  // Инициализация WaveSurfer
  let wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: "#ddd",
    progressColor: "#007aff",
    cursorColor: "#007aff",
    backend: "WebAudio",
    responsive: true,
    plugins: [
      WaveSurfer.regions.create({
        regions: [],
        dragSelection: false,
      }),
    ],
  });

  // Состояние приложения
  let bpm = parseInt(bpmInput.value, 10) || 120;
  let beatInterval = (60 / bpm) * 1000;
  let beatTimer = null;
  let currentBeat = 1;
  let lastTime = 0;
  let undoStack = []; // Стек для отмены действий

  // ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================

  // Загрузка файла
  selectFileBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) loadAudio(file);
  });

  // Drag & Drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) loadAudio(file);
  });

  // Управление воспроизведением
  playBtn.addEventListener("click", () => {
    lastTime = wavesurfer.getCurrentTime();
    wavesurfer.play();
    startBeatCounter();
  });

  pauseBtn.addEventListener("click", () => {
    wavesurfer.pause();
    stopBeatCounter();
  });

  // Отметка паттерна
  markPatternBtn.addEventListener("click", () => {
    const currentTime = wavesurfer.getCurrentTime();
    const regionId = `pattern-${Date.now()}`;

    wavesurfer.addRegion({
      start: currentTime,
      end: currentTime + 1,
      color: "rgba(255, 0, 0, 0.5)",
      drag: true,
      resize: false,
      id: regionId,
    });

    addPatternLabel(regionId, currentTime);
    undoStack.push(regionId); // Сохраняем в историю

    const newTime = Math.max(0, currentTime - 3);
    wavesurfer.seekTo(newTime / wavesurfer.getDuration());
    lastTime = wavesurfer.getCurrentTime();
  });

  // Отмена последнего паттерна
  undoPatternBtn.addEventListener("click", () => {
    if (undoStack.length === 0) {
      alert("Нет паттернов для отмены!");
      return;
    }

    const lastPatternId = undoStack.pop();
    const region = wavesurfer.regions.list[lastPatternId];
    const label = document.querySelector(`[data-id="${lastPatternId}"]`);

    if (region) region.remove();
    if (label) label.remove();
  });

  // Управление BPM
  setBpmBtn.addEventListener("click", () => {
    const newBpm = parseInt(bpmInput.value, 10);
    if (newBpm > 0) {
      bpm = newBpm;
      beatInterval = (60 / bpm) * 1000;
      if (beatTimer) {
        stopBeatCounter();
        startBeatCounter();
      }
    }
  });

  // ==================== ФУНКЦИИ ====================

  function loadAudio(file) {
    if (!file.type.startsWith("audio/")) {
      alert("Загрузите аудиофайл!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => wavesurfer.load(e.target.result);
    reader.onerror = () => alert("Ошибка чтения файла");
    reader.readAsDataURL(file);
  }

  function addPatternLabel(id, time) {
    const label = document.createElement("div");
    label.className = "pattern-label added";
    label.innerHTML = '<i class="ri-map-pin-2-line"></i>';
    label.style.left = `${(time / wavesurfer.getDuration()) * 100}%`;
    label.dataset.id = id;

    interact(label).draggable({
      listeners: {
        move(e) {
          const left =
            parseFloat(e.target.style.left) +
            (e.dx / patternsContainer.clientWidth) * 100;
          e.target.style.left = `${Math.max(0, Math.min(100, left))}%`;

          const region = wavesurfer.regions.list[id];
          if (region) {
            region.update({
              start: (left / 100) * wavesurfer.getDuration(),
              end: (left / 100) * wavesurfer.getDuration() + 0.1,
            });
          }
        },
      },
    });

    label.addEventListener("dblclick", () => {
      if (confirm("Удалить паттерн?")) {
        wavesurfer.regions.list[id]?.remove();
        label.remove();
        undoStack = undoStack.filter((item) => item !== id);
      }
    });

    patternsContainer.appendChild(label);
    setTimeout(() => label.classList.remove("added"), 500);
  }

  function startBeatCounter() {
    if (beatTimer) return;
    currentBeat = 1;
    updateBeatCounter();

    beatTimer = setInterval(() => {
      currentBeat = (currentBeat % 8) + 1;
      updateBeatCounter();
    }, beatInterval);
  }

  function stopBeatCounter() {
    clearInterval(beatTimer);
    beatTimer = null;
    resetBeatHighlight();
  }

  function updateBeatCounter() {
    beats.forEach((b) =>
      b.classList.toggle("active", +b.dataset.beat === currentBeat)
    );
  }

  function resetBeatCounter() {
    currentBeat = 1;
    updateBeatCounter();
  }

  function resetBeatHighlight() {
    beats.forEach((b) => b.classList.remove("active"));
  }

  // ==================== WAVESURFER EVENTS ====================

  wavesurfer.on("audioprocess", () => {
    const currentTime = wavesurfer.getCurrentTime();
    currentTimeDisplay.textContent = formatTime(currentTime);

    Object.values(wavesurfer.regions.list).forEach((region) => {
      if (region.start >= lastTime && region.start < currentTime) {
        resetBeatCounter();
      }
    });

    lastTime = currentTime;
  });

  wavesurfer.on("seek", () => {
    lastTime = wavesurfer.getCurrentTime();
  });

  wavesurfer.on("ready", () => {
    stopBeatCounter();
    lastTime = 0;
    const duration = wavesurfer.getDuration();
    totalTimeDisplay.textContent = formatTime(duration);
    currentTimeDisplay.textContent = "00:00";
  });

  wavesurfer.on("finish", () => {
    stopBeatCounter();
    lastTime = 0;
  });

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }
});
