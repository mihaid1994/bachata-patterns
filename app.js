// app.js

document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const selectFileBtn = document.getElementById("selectFileBtn");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const markPatternBtn = document.getElementById("markPatternBtn");

  // Контейнер для ярлыков паттернов
  const patternsContainer = document.getElementById("patternsContainer");

  // Счётчик битов
  const beatCounter = document.getElementById("beatCounter");
  const beats = beatCounter.querySelectorAll(".beat");

  // BPM
  const bpmInput = document.getElementById("bpmInput");
  const setBpmBtn = document.getElementById("setBpmBtn");

  // Отображение текущего времени / общего времени
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

  // Параметры счётчика битов
  let bpm = parseInt(bpmInput.value, 10) || 120;
  let beatInterval = (60 / bpm) * 1000; // Интервал в мс
  let beatTimer = null;
  let currentBeat = 1;

  // Для отслеживания «перешли ли мы» начало паттерна
  let lastTime = 0;

  // ======== Загрузка аудиофайла ========
  selectFileBtn.addEventListener("click", () => {
    fileInput.click();
  });

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

  // ======== Кнопки воспроизведения ========
  playBtn.addEventListener("click", () => {
    // При старте сбрасываем lastTime
    lastTime = wavesurfer.getCurrentTime();
    wavesurfer.play();
    startBeatCounter();
  });

  pauseBtn.addEventListener("click", () => {
    wavesurfer.pause();
    stopBeatCounter();
  });

  // ======== Отметка Паттерна (перемотка на 3 секунды назад) ========
  markPatternBtn.addEventListener("click", () => {
    const currentTime = wavesurfer.getCurrentTime();
    const regionId = `pattern-${Date.now()}`;

    // Добавляем регион (паттерн)
    wavesurfer.addRegion({
      start: currentTime,
      end: currentTime + 0.3,
      color: "rgba(255, 0, 0, 0.5)",
      drag: true,
      resize: false,
      id: regionId,
    });
    // Создаём визуальный ярлык
    addPatternLabel(regionId, currentTime);

    // Перематываем на 3 секунды назад
    const newTime = Math.max(0, currentTime - 3);
    wavesurfer.seekTo(newTime / wavesurfer.getDuration());
    // При этом lastTime можно заново обновить
    lastTime = wavesurfer.getCurrentTime();
  });

  // ======== Установка BPM ========
  setBpmBtn.addEventListener("click", () => {
    const newBpm = parseInt(bpmInput.value, 10);
    if (newBpm && newBpm > 0) {
      bpm = newBpm;
      beatInterval = (60 / bpm) * 1000;
      if (beatTimer) {
        stopBeatCounter();
        startBeatCounter();
      }
      alert(`BPM установлен на ${bpm}`);
    } else {
      alert("Некорректный BPM!");
    }
  });

  // ======== Функция загрузки аудиофайла ========
  function loadAudio(file) {
    if (!file.type.startsWith("audio/")) {
      alert("Загрузите аудиофайл!");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      wavesurfer.load(e.target.result);
    };
    reader.onerror = () => alert("Ошибка при чтении файла.");
    reader.readAsDataURL(file);
  }

  // ======== Добавление визуального ярлыка паттерна ========
  function addPatternLabel(id, time) {
    const label = document.createElement("div");
    label.classList.add("pattern-label", "added");
    label.innerHTML = '<i class="ri-map-pin-2-line"></i>'; // Иконка Remix
    label.style.left = `${(time / wavesurfer.getDuration()) * 100}%`;
    label.dataset.id = id;

    // Драг для ярлыка
    interact(label).draggable({
      listeners: {
        move(evt) {
          const target = evt.target;
          let left = parseFloat(target.style.left);
          left += (evt.dx / patternsContainer.clientWidth) * 100;
          left = Math.max(0, Math.min(100, left));
          target.style.left = left + "%";

          // Синхронизируем region
          const region = wavesurfer.regions.list[id];
          if (region) {
            const newTime = (left / 100) * wavesurfer.getDuration();
            region.update({ start: newTime, end: newTime + 0.1 });
          }
        },
      },
    });

    // Удаление паттерна при двойном клике
    label.addEventListener("dblclick", () => {
      if (confirm("Удалить этот паттерн?")) {
        wavesurfer.regions.list[id]?.remove();
        label.remove();
      }
    });

    patternsContainer.appendChild(label);

    setTimeout(() => label.classList.remove("added"), 500);
  }

  // ======== Счётчик битов ========
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
    console.log("Счёт сброшен на паттерне!");
  }

  function resetBeatHighlight() {
    beats.forEach((b) => b.classList.remove("active"));
  }

  // ======== ЛОГИКА СБРОСА СЧЁТА ПРИ ПЕРЕСЕЧЕНИИ ПАТТЕРНА ========
  wavesurfer.on("audioprocess", () => {
    const currentTime = wavesurfer.getCurrentTime();
    currentTimeDisplay.textContent = formatTime(currentTime);

    // Смотрим все регионы; если region.start между lastTime и currentTime -> сбрасываем счёт
    const regions = Object.values(wavesurfer.regions.list);
    regions.forEach((region) => {
      if (region.start >= lastTime && region.start < currentTime) {
        resetBeatCounter();
      }
    });

    lastTime = currentTime;
  });

  // При seek
  wavesurfer.on("seek", () => {
    lastTime = wavesurfer.getCurrentTime();
  });

  // Когда трек готов
  wavesurfer.on("ready", () => {
    stopBeatCounter();
    lastTime = 0;
    const duration = wavesurfer.getDuration();
    totalTimeDisplay.textContent = formatTime(duration);
    currentTimeDisplay.textContent = "00:00";
  });

  // Когда трек доиграл
  wavesurfer.on("finish", () => {
    stopBeatCounter();
    lastTime = 0;
  });

  // Форматирование времени мм:сс
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
  }
});
