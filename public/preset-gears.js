{
  const screen = document.getElementById("models");
  const canvas = document.getElementById("preset-gears");
  const context = canvas.getContext("2d");
  const motionButton = document.getElementById("gear-motion");
  const caption = screen.querySelector(".gear-caption");
  const captionName = caption.querySelector(".gear-caption-name");
  const captionWeight = caption.querySelector(".gear-caption-weight");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const buttons = [...screen.querySelectorAll("[data-tier]")];

  const turn = Math.PI * 2;
  const gearPeaks = [-0.5, -0.32, -0.22, 0.22, 0.32, 0.5];
  const dimensions = [
    { teeth: 10, axis: 0, zoom: 2.05 },
    { teeth: 15, axis: -0.51, zoom: 1.72 },
    { teeth: 21, axis: 0.56, zoom: 1.52 },
    { teeth: 28, axis: -0.43, zoom: 1.36 },
  ];
  const drawingWidth = 550;
  const drawingHeight = 270;

  function toothOutline(teeth, radius) {
    const path = new Path2D();
    const root = radius - 4.3;
    const crown = radius + 5.1;
    const spacing = turn / teeth;
    for (let tooth = 0; tooth < teeth; tooth++) {
      for (const [index, edge] of gearPeaks.entries()) {
        const angle = (tooth + edge) * spacing;
        const length = index === 2 || index === 3 ? crown : root;
        path.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      }
    }
    path.closePath();
    return path;
  }

  const gears = [];
  for (const [index, { teeth, axis, zoom }] of dimensions.entries()) {
    const radius = teeth * 3.45;
    const spacing = turn / teeth;
    const previous = gears.at(-1);
    const distance = previous ? previous.radius + radius : 0;
    // Pitch circles touch. The opposing tooth starts half a pitch from its mate.
    const previousTeeth = previous ? (axis - previous.angle) / previous.spacing : 0;
    gears.push({
      button: buttons[index],
      x: previous ? previous.x + Math.cos(axis) * distance : 86,
      y: previous ? previous.y + Math.sin(axis) * distance : 163,
      radius,
      spacing,
      zoom,
      direction: index % 2 === 0 ? 1 : -1,
      angle: previous ? axis + Math.PI - (0.5 - previousTeeth) * spacing : 0,
      outline: toothOutline(teeth, radius),
    });
  }

  let inspected = null;
  let pointed = null;
  let focused = null;
  let pinned = null;
  let paused = false;
  let frame = 0;
  let lastTime = 0;
  let width = 0;
  let height = 0;
  let deviceScale = 1;
  const camera = { zoom: 1, x: 0, y: 0 };

  function circle(radius, fill, stroke, line = 1) {
    context.beginPath();
    context.arc(0, 0, radius, 0, turn);
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.lineWidth = line;
      context.strokeStyle = stroke;
      context.stroke();
    }
  }

  function drawGear(gear) {
    const { x, y, radius, angle, outline } = gear;
    const active = inspected === gear;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    const metal = context.createLinearGradient(-radius, -radius, radius, radius);
    metal.addColorStop(0, active ? "#a9ffdc" : "#b0dad2");
    metal.addColorStop(0.42, active ? "#38e9b5" : "#5b9b8c");
    metal.addColorStop(1, active ? "#08785e" : "#315a53");

    context.shadowColor = "#071c19cc";
    context.shadowBlur = 8;
    context.shadowOffsetY = 5;
    context.fillStyle = metal;
    context.fill(outline);
    context.shadowColor = "transparent";
    context.strokeStyle = active ? "#86ffd0" : "#80b9ab";
    context.lineWidth = 1;
    context.stroke(outline);

    circle(radius * 0.77, active ? "#15a47e" : "#426f64", active ? "#98ffd6" : "#86b9aa");
    circle(radius * 0.68, metal, active ? "#1a9a76" : "#224c43");

    const boreCount = radius > 60 ? 6 : 4;
    for (let index = 0; index < boreCount; index++) {
      const angle = (index / boreCount) * turn;
      context.save();
      context.translate(Math.cos(angle) * radius * 0.49, Math.sin(angle) * radius * 0.49);
      circle(radius * 0.091, active ? "#095642" : "#183a35", active ? "#8df8cb" : "#78aa9c");
      context.restore();
    }

    circle(radius * 0.3, metal, active ? "#187a60" : "#265148", 1.4);
    circle(radius * 0.16, active ? "#07553f" : "#16382f", active ? "#b4ffe0" : "#85b9aa");
    context.restore();
  }

  function baseView() {
    const scale = Math.min(width / drawingWidth, height / drawingHeight);
    return { scale, x: (width - drawingWidth * scale) / 2, y: (height - drawingHeight * scale) / 2 };
  }

  function inspectionView(view) {
    if (!inspected || reducedMotion.matches) return { zoom: 1, x: 0, y: 0 };
    const edge = inspected.radius + 5.1;
    const inset = 8;
    const zoom = Math.min(inspected.zoom, (Math.min(width, height) - inset * 2) / (edge * 2 * view.scale));
    const padding = edge * zoom * view.scale + inset;
    const x = Math.min(width - padding, Math.max(padding, view.x + inspected.x * view.scale));
    const y = Math.min(height - padding, Math.max(padding, view.y + inspected.y * view.scale));
    return {
      zoom,
      x: (x - view.x) / view.scale - inspected.x * zoom,
      y: (y - view.y) / view.scale - inspected.y * zoom,
    };
  }

  function draw(time) {
    frame = 0;
    if (screen.hidden || !width || !height) {
      lastTime = 0;
      return;
    }
    const seconds = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    const moving = !paused && !reducedMotion.matches;
    const view = baseView();
    const { zoom, x, y } = inspectionView(view);
    const zooming = Math.abs(camera.zoom - zoom) > 0.002 ||
      Math.abs(camera.x - x) > 0.35 || Math.abs(camera.y - y) > 0.35;
    const blend = !zooming || reducedMotion.matches ? 1 : 1 - Math.exp(-14 * seconds);
    camera.zoom += (zoom - camera.zoom) * blend;
    camera.x += (x - camera.x) * blend;
    camera.y += (y - camera.y) * blend;

    context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    context.clearRect(0, 0, width, height);
    context.translate(view.x + view.scale * camera.x, view.y + view.scale * camera.y);
    context.scale(view.scale * camera.zoom, view.scale * camera.zoom);
    for (const gear of gears) {
      if (moving && inspected !== gear) {
        gear.angle += seconds * gear.direction * gear.spacing * 2.5;
      }
      drawGear(gear);
    }
    if (moving || zooming) scheduleDraw();
    else lastTime = 0;
  }

  function scheduleDraw() {
    if (!screen.hidden && !frame) frame = requestAnimationFrame(draw);
  }

  function inspect() {
    const next = pointed ?? focused ?? pinned;
    if (next === inspected) return;
    inspected?.button.removeAttribute("data-inspected");
    inspected = next;
    caption.hidden = !inspected;
    if (inspected) {
      inspected.button.setAttribute("data-inspected", "");
      captionName.textContent = inspected.button.querySelector("strong").textContent;
      captionWeight.textContent = inspected.button.querySelector(".weight").textContent;
    }
    scheduleDraw();
  }

  function gearAt(event) {
    const bounds = canvas.getBoundingClientRect();
    const view = baseView();
    if (!view.scale) return null;
    const x = ((event.clientX - bounds.left - view.x) / view.scale - camera.x) / camera.zoom;
    const y = ((event.clientY - bounds.top - view.y) / view.scale - camera.y) / camera.zoom;
    return gears.find((gear) => Math.hypot(x - gear.x, y - gear.y) < gear.radius + 5) ?? null;
  }

  function clearPointer() {
    pointed = null;
    canvas.removeAttribute("data-hovered");
    inspect();
  }

  for (const gear of gears) {
    const { button } = gear;
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      pointed = gear;
      inspect();
    });
    button.addEventListener("pointerleave", clearPointer);
    button.addEventListener("focus", () => {
      if (button.matches(":focus-visible")) focused = gear;
      inspect();
    });
    button.addEventListener("blur", () => {
      focused = null;
      inspect();
    });
    button.addEventListener("click", () => {
      pinned = gear;
      inspect();
    });
  }

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointed = gearAt(event);
    canvas.toggleAttribute("data-hovered", Boolean(pointed));
    inspect();
  });
  canvas.addEventListener("pointerleave", clearPointer);
  canvas.addEventListener("click", (event) => gearAt(event)?.button.click());
  screen.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    pinned = null;
    focused = null;
    clearPointer();
  });

  function updateMotionButton() {
    motionButton.hidden = reducedMotion.matches;
    motionButton.textContent = paused ? "Resume gears" : "Pause gears";
    scheduleDraw();
  }

  motionButton.addEventListener("click", () => {
    paused = !paused;
    updateMotionButton();
  });
  reducedMotion.addEventListener("change", updateMotionButton);
  updateMotionButton();

  new ResizeObserver(([{ contentRect }]) => {
    width = contentRect.width;
    height = contentRect.height;
    if (!width || !height) return;
    deviceScale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * deviceScale);
    canvas.height = Math.round(height * deviceScale);
    scheduleDraw();
  }).observe(canvas);

  new MutationObserver(() => {
    if (screen.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      focused = null;
      pinned = null;
      clearPointer();
      Object.assign(camera, { zoom: 1, x: 0, y: 0 });
    } else {
      scheduleDraw();
    }
  }).observe(screen, { attributes: true, attributeFilter: ["hidden"] });
}
