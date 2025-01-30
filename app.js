document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const selectFileBtn = document.getElementById("selectFileBtn");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const markPatternBtn = document.getElementById("markPatternBtn");
  const undoPatternBtn = document.getElementById("undoPatternBtn");
  const savePatternsBtn = document.getElementById("savePatternsBtn");
  const loadPatternsBtn = document.getElementById("loadPatternsBtn");
  const patternsContainer = document.getElementById("patternsContainer");

  // Ползунок воспроизведения
  const customProgress = document.getElementById("customProgress");

  // Счётчик битов
  const beatCounter = document.getElementById("beatCounter");
  const beats = beatCounter.querySelectorAll(".beat");
  const bpmInput = document.getElementById("bpmInput");
  const setBpmBtn = document.getElementById("setBpmBtn");
  const presetBpmButtons = document.querySelectorAll(".preset-bpm-btn");

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
        dragSelection: false, // Отключаем выделение мышью
      }),
    ],
  });

  // Параметры для счётчика
  let bpm = parseInt(bpmInput.value, 10) || 120;
  let beatInterval = (60 / bpm) * 1000;
  let beatTimer = null;
  let currentBeat = 1;

  // Для отслеживания пересечения паттерна
  let lastTime = 0;

  // Список ID паттернов в порядке добавления, чтобы отменять последний
  let patternHistory = [];

  // ======== Загрузка аудио ========
  selectFileBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) loadAudio(file);
  });

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

  // ======== Контролы воспроизведения ========
  playBtn.addEventListener("click", () => {
    lastTime = wavesurfer.getCurrentTime();
    wavesurfer.play();
    startBeatCounter();
  });

  pauseBtn.addEventListener("click", () => {
    wavesurfer.pause();
    stopBeatCounter();
  });

  // ======== Ползунок воспроизведения (customProgress) ========
  // При изменении ползунка - перелистываем Wavesurfer
  customProgress.addEventListener("input", () => {
    const val = +customProgress.value; // 0..100
    wavesurfer.seekTo(val / 100); // seekTo - доля от 0..1
  });

  // Обновляем ползунок при изменении Wavesurfer
  function updateCustomProgress() {
    const duration = wavesurfer.getDuration();
    if (duration > 0) {
      const current = wavesurfer.getCurrentTime();
      const percent = (current / duration) * 100;
      customProgress.value = percent;
    }
  }

  // ======== Отметка паттерна ========
  markPatternBtn.addEventListener("click", () => {
    const ct = wavesurfer.getCurrentTime();
    // Добавляем регион
    const regionId = `pattern-${Date.now()}`;
    const region = wavesurfer.addRegion({
      start: ct,
      end: ct + 0.1,
      color: "rgba(255, 0, 0, 0.5)",
      drag: true,
      resize: false,
      id: regionId,
    });
    addPatternLabel(regionId, ct);
    patternHistory.push(regionId);

    // Перемотка на 5 секунд назад, чтобы переслушать
    const newTime = Math.max(0, ct - 5);
    wavesurfer.seekTo(newTime / wavesurfer.getDuration());
    lastTime = wavesurfer.getCurrentTime(); // Сбросим для корректного пересечения
  });

  // ======== Отменить последний паттерн ========
  undoPatternBtn.addEventListener("click", () => {
    if (patternHistory.length > 0) {
      const lastId = patternHistory.pop();
      // Удаляем регион
      wavesurfer.regions.list[lastId]?.remove();
      // Удаляем ярлык
      const label = patternsContainer.querySelector(`[data-id="${lastId}"]`);
      if (label) {
        label.remove();
      }
    } else {
      alert("Нет паттернов для отмены");
    }
  });

  // ======== Сохранение паттернов ========
  savePatternsBtn.addEventListener("click", () => {
    const regs = wavesurfer.regions.list;
    const patterns = Object.keys(regs).map((id) => ({
      id,
      start: regs[id].start,
      end: regs[id].end,
    }));
    const jsonData = JSON.stringify(patterns, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "patterns.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // ======== Загрузка паттернов ========
  loadPatternsBtn.addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json";
    inp.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const rdr = new FileReader();
      rdr.onload = (ev) => {
        try {
          const patterns = JSON.parse(ev.target.result);
          patterns.forEach((p) => {
            const region = wavesurfer.addRegion({
              start: p.start,
              end: p.end,
              color: "rgba(255, 0, 0, 0.5)",
              drag: true,
              resize: false,
              id: p.id,
            });
            addPatternLabel(p.id, p.start);
            patternHistory.push(p.id);
          });
        } catch {
          alert("Неверный формат JSON паттернов");
        }
      };
      rdr.readAsText(file);
    });
    inp.click();
  });

  // ======== Установка BPM ========
  setBpmBtn.addEventListener("click", () => {
    const newBpm = parseInt(bpmInput.value, 10);
    if (newBpm && newBpm > 0) {
      bpm = newBpm;
      beatInterval = (60 / bpm) * 1000;
      // Перезапустим счётчик, если идёт воспроизведение
      if (beatTimer) {
        stopBeatCounter();
        startBeatCounter();
      }
      alert(`BPM установлен на ${bpm}`);
    } else {
      alert("Некорректный BPM");
    }
  });

  // ======== Предустановленные BPM ========
  presetBpmButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const presetBpm = parseInt(btn.dataset.bpm, 10);
      if (presetBpm && presetBpm > 0) {
        bpm = presetBpm;
        bpmInput.value = presetBpm;
        beatInterval = (60 / bpm) * 1000;
        if (beatTimer) {
          stopBeatCounter();
          startBeatCounter();
        }
        alert(`BPM установлен на ${bpm} (предустановленный)`);
      }
    });
  });

  // ======== Загрузка аудио ========
  function loadAudio(file) {
    if (!file.type.startsWith("audio/")) {
      alert("Пожалуйста, загрузите аудиофайл!");
      return;
    }
    const rdr = new FileReader();
    rdr.onload = (e) => {
      wavesurfer.load(e.target.result);
      patternHistory = []; // Очистим историю паттернов при загрузке нового трека
    };
    rdr.readAsDataURL(file);
  }

  // ======== Добавление ярлыка паттерна ========
  function addPatternLabel(id, time) {
    const lb = document.createElement("div");
    lb.classList.add("pattern-label", "added");
    lb.innerHTML = '<i class="ri-map-pin-2-line"></i>'; // Иконка Remix
    lb.style.left = `${(time / wavesurfer.getDuration()) * 100}%`;
    lb.dataset.id = id;

    // Перетаскивание
    interact(lb).draggable({
      listeners: {
        move(evt) {
          const target = evt.target;
          let left = parseFloat(target.style.left);
          left += (evt.dx / patternsContainer.clientWidth) * 100;
          left = Math.max(0, Math.min(100, left));
          target.style.left = left + "%";
          // Обновление region
          const region = wavesurfer.regions.list[id];
          if (region) {
            const nt = (left / 100) * wavesurfer.getDuration();
            region.update({ start: nt, end: nt + 0.1 });
          }
        },
      },
    });

    // Удаление паттерна по dblclick
    lb.addEventListener("dblclick", () => {
      if (confirm("Удалить этот паттерн?")) {
        wavesurfer.regions.list[id]?.remove();
        lb.remove();
        // Уберём из истории
        patternHistory = patternHistory.filter((x) => x !== id);
      }
    });

    patternsContainer.appendChild(lb);

    setTimeout(() => lb.classList.remove("added"), 500);
  }

  // ======== СЧЁТЧИК БИТОВ ========
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
    if (beatTimer) {
      clearInterval(beatTimer);
      beatTimer = null;
      resetBeatHighlight();
    }
  }

  function updateBeatCounter() {
    beats.forEach((b) => {
      b.classList.remove("active");
      if (+b.dataset.beat === currentBeat) {
        b.classList.add("active");
      }
    });
  }

  function resetBeatCounter() {
    currentBeat = 1;
    updateBeatCounter();
    console.log("Счёт сброшен на паттерне");
  }

  function resetBeatHighlight() {
    beats.forEach((b) => b.classList.remove("active"));
  }

  // ======== ЛОГИКА ПЕРЕШАГИВАНИЯ ПАТТЕРНА (audioprocess) ========
  wavesurfer.on("audioprocess", () => {
    const currentTime = wavesurfer.getCurrentTime();
    currentTimeDisplay.textContent = formatTime(currentTime);

    // Обновляем ползунок
    updateCustomProgress();

    // Проверяем регионы: если region.start лежит между lastTime и currentTime => сброс
    const regs = Object.values(wavesurfer.regions.list);
    regs.forEach((region) => {
      if (region.start >= lastTime && region.start < currentTime) {
        resetBeatCounter();
      }
    });

    lastTime = currentTime;
  });

  // При seek
  wavesurfer.on("seek", () => {
    lastTime = wavesurfer.getCurrentTime();
    updateCustomProgress();
  });

  // При ready
  wavesurfer.on("ready", () => {
    stopBeatCounter();
    lastTime = 0;
    const dur = wavesurfer.getDuration();
    totalTimeDisplay.textContent = formatTime(dur);
    currentTimeDisplay.textContent = "00:00";
    updateCustomProgress();
  });

  // При finish
  wavesurfer.on("finish", () => {
    stopBeatCounter();
    lastTime = 0;
    updateCustomProgress();
  });

  // Если region удалён
  wavesurfer.on("region-removed", () => {
    // По желанию, можно что-то делать
  });

  // ======== Функция обновления кастомного ползунка ========
  function updateCustomProgress() {
    const dur = wavesurfer.getDuration();
    if (dur > 0) {
      const ct = wavesurfer.getCurrentTime();
      const val = (ct / dur) * 100;
      customProgress.value = val;
    }
  }

  // Форматирование времени mm:ss
  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
  }
});
