(() => {
  "use strict";

  const TEMPLATE_URL = "assets/flyer-template.png";
  const canvas = document.getElementById("flyerCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const nameInput = document.getElementById("fullName");
  const photoInput = document.getElementById("photoInput");
  const uploadTitle = document.getElementById("uploadTitle");
  const uploadSub = document.getElementById("uploadSub");
  const uploadAction = document.getElementById("uploadAction");
  const uploadBox = document.getElementById("uploadBox");
  const errorMessage = document.getElementById("errorMessage");
  const photoControls = document.getElementById("photoControls");
  const zoomRange = document.getElementById("zoomRange");
  const zoomOutput = document.getElementById("zoomOutput");
  const resetPhoto = document.getElementById("resetPhoto");
  const downloadBtn = document.getElementById("downloadBtn");
  const downloadHelp = document.getElementById("downloadHelp");
  const canvasHint = document.getElementById("canvasHint");

  // Coordinates are in the original 1229 × 1536 artwork coordinate system.
  // The photo rectangle follows the white frame in the supplied flyer.
  const PHOTO_FRAME = { x: 686, y: 508, w: 463, h: 582, r: 27 };
  // The name occupies the open navy area directly below the attendance banner.
  const NAME_AREA = { x: 82, y: 727, w: 535, h: 282 };

  const template = new Image();
  let templateReady = false;
  let photo = null;
  let photoURL = null;
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let dragStart = null;
  let lastPointer = null;

  template.onload = () => {
    templateReady = true;
    canvas.width = template.naturalWidth;
    canvas.height = template.naturalHeight;
    draw();
  };
  template.onerror = () => showError("The flyer template could not be loaded. Keep the assets folder beside index.html.");
  template.src = TEMPLATE_URL;

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }
  function clearError() {
    errorMessage.hidden = true;
    errorMessage.textContent = "";
  }
  function roundedRectPath(c, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + radius, y);
    c.arcTo(x + w, y, x + w, y + h, radius);
    c.arcTo(x + w, y + h, x, y + h, radius);
    c.arcTo(x, y + h, x, y, radius);
    c.arcTo(x, y, x + w, y, radius);
    c.closePath();
  }
  function getPhotoLayout() {
    if (!photo) return null;
    const coverScale = Math.max(PHOTO_FRAME.w / photo.naturalWidth, PHOTO_FRAME.h / photo.naturalHeight);
    const scale = coverScale * zoom;
    const width = photo.naturalWidth * scale;
    const height = photo.naturalHeight * scale;
    const minX = PHOTO_FRAME.x + PHOTO_FRAME.w - width;
    const maxX = PHOTO_FRAME.x;
    const minY = PHOTO_FRAME.y + PHOTO_FRAME.h - height;
    const maxY = PHOTO_FRAME.y;
    // Clamp image offsets so no uncovered gaps can appear inside the frame.
    offsetX = width <= PHOTO_FRAME.w ? (PHOTO_FRAME.w - width) / 2 : Math.min(maxX, Math.max(minX, offsetX));
    offsetY = height <= PHOTO_FRAME.h ? (PHOTO_FRAME.h - height) / 2 : Math.min(maxY, Math.max(minY, offsetY));
    return { x: offsetX, y: offsetY, w: width, h: height };
  }
  function wrapLines(text, maxWidth, font) {
    ctx.font = font;
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        if (!line && ctx.measureText(word).width > maxWidth) {
          let piece = "";
          for (const ch of word) {
            if (ctx.measureText(piece + ch).width > maxWidth && piece) {
              lines.push(piece);
              piece = ch;
            } else piece += ch;
          }
          line = piece;
        } else line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  function drawName() {
    const name = nameInput.value.replace(/\s+/g, " ").trim();
    if (!name) return;
    let fontSize = 58;
    let lines = [];
    let lineHeight = 1.14;
    while (fontSize >= 25) {
      const font = `800 ${fontSize}px Inter, Arial, sans-serif`;
      lines = wrapLines(name, NAME_AREA.w, font);
      if (lines.length * fontSize * lineHeight <= NAME_AREA.h) break;
      fontSize -= 2;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(NAME_AREA.x, NAME_AREA.y, NAME_AREA.w, NAME_AREA.h);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `800 ${fontSize}px Inter, Arial, sans-serif`;
    const blockHeight = lines.length * fontSize * lineHeight;
    let y = NAME_AREA.y + Math.max(0, (NAME_AREA.h - blockHeight) / 2);
    for (const line of lines) {
      ctx.fillText(line, NAME_AREA.x, y, NAME_AREA.w);
      y += fontSize * lineHeight;
    }
    ctx.restore();
  }
  function draw() {
    if (!templateReady) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

    if (photo) {
      const layout = getPhotoLayout();
      ctx.save();
      roundedRectPath(ctx, PHOTO_FRAME.x, PHOTO_FRAME.y, PHOTO_FRAME.w, PHOTO_FRAME.h, PHOTO_FRAME.r);
      ctx.clip();
      ctx.drawImage(photo, layout.x, layout.y, layout.w, layout.h);
      ctx.restore();
    }
    drawName();
  }
  function resetPhotoPosition() {
    zoom = 1;
    zoomRange.value = "1";
    zoomOutput.value = "1.0×";
    if (photo) {
      const coverScale = Math.max(PHOTO_FRAME.w / photo.naturalWidth, PHOTO_FRAME.h / photo.naturalHeight);
      offsetX = PHOTO_FRAME.x + (PHOTO_FRAME.w - photo.naturalWidth * coverScale) / 2;
      offsetY = PHOTO_FRAME.y + (PHOTO_FRAME.h - photo.naturalHeight * coverScale) / 2;
    } else {
      offsetX = PHOTO_FRAME.x;
      offsetY = PHOTO_FRAME.y;
    }
    draw();
  }
  function readImage(file) {
    clearError();
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const extAllowed = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!allowed.includes(file.type) && !extAllowed) {
      showError("Unsupported file type. Please choose a JPG, JPEG, PNG or WebP image.");
      photoInput.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showError("This image is larger than 15 MB. Please choose a smaller photograph.");
      photoInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => showError("This photograph could not be read. Please try another image.");
    reader.onload = () => {
      const candidate = new Image();
      candidate.onload = () => {
        if (photoURL) URL.revokeObjectURL(photoURL);
        photoURL = URL.createObjectURL(file);
        photo = candidate;
        uploadTitle.textContent = file.name;
        uploadSub.textContent = `${Math.round(file.size / 1024)} KB · photo ready`;
        uploadAction.textContent = "Replace photo";
        photoControls.hidden = false;
        canvasHint.classList.add("hidden");
        resetPhotoPosition();
      };
      candidate.onerror = () => showError("The selected file is not a valid image. Please try another one.");
      candidate.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  nameInput.addEventListener("input", draw);
  photoInput.addEventListener("change", () => readImage(photoInput.files && photoInput.files[0]));
  zoomRange.addEventListener("input", () => {
    const previousZoom = zoom;
    zoom = Number(zoomRange.value);
    zoomOutput.value = `${zoom.toFixed(2).replace(/0$/, "")}×`;
    if (photo && previousZoom > 0) {
      const centerX = PHOTO_FRAME.x + PHOTO_FRAME.w / 2;
      const centerY = PHOTO_FRAME.y + PHOTO_FRAME.h / 2;
      offsetX = centerX - (centerX - offsetX) * (zoom / previousZoom);
      offsetY = centerY - (centerY - offsetY) * (zoom / previousZoom);
    }
    draw();
  });
  resetPhoto.addEventListener("click", resetPhotoPosition);

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (!photo) return;
    const p = canvasPoint(event);
    if (p.x >= PHOTO_FRAME.x && p.x <= PHOTO_FRAME.x + PHOTO_FRAME.w &&
        p.y >= PHOTO_FRAME.y && p.y <= PHOTO_FRAME.y + PHOTO_FRAME.h) {
      dragging = true;
      dragStart = { x: p.x, y: p.y, offsetX, offsetY };
      lastPointer = p;
      canvas.setPointerCapture?.(event.pointerId);
      canvas.style.cursor = "grabbing";
      event.preventDefault();
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || !dragStart) {
      const p = canvasPoint(event);
      canvas.style.cursor = photo && p.x >= PHOTO_FRAME.x && p.x <= PHOTO_FRAME.x + PHOTO_FRAME.w &&
        p.y >= PHOTO_FRAME.y && p.y <= PHOTO_FRAME.y + PHOTO_FRAME.h ? "grab" : "default";
      return;
    }
    const p = canvasPoint(event);
    offsetX = dragStart.offsetX + (p.x - dragStart.x);
    offsetY = dragStart.offsetY + (p.y - dragStart.y);
    lastPointer = p;
    draw();
  });
  function endDrag() {
    dragging = false;
    dragStart = null;
    lastPointer = null;
    canvas.style.cursor = "default";
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", endDrag);

  downloadBtn.addEventListener("click", () => {
    clearError();
    if (!templateReady) {
      showError("The flyer is still loading. Please try again in a moment.");
      return;
    }
    if (!nameInput.value.trim()) {
      showError("Please enter your full name before downloading your flyer.");
      nameInput.focus();
      return;
    }
    // Redraw at template resolution, never capture the surrounding web page.
    draw();
    canvas.toBlob((blob) => {
      if (!blob) {
        showError("Your flyer could not be exported. Please try another browser.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = nameInput.value.trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "participant";
      link.href = url;
      link.download = `sholitech-${safeName}-flyer.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      downloadHelp.textContent = "Your PNG flyer is ready. Check your Downloads folder.";
    }, "image/png");
  });

  // Initial render and clear upload errors when a new file is selected.
  draw();
})();