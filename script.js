// ======= script.js （替换你现有的 script.js） =======

const axisEl = document.getElementById("axis");
const ticksEl = document.getElementById("ticks");
const coursesContainer = document.getElementById("coursesContainer");
const tooltip = document.getElementById("tooltip");
const currentTimeLine = document.getElementById("currentTimeLine");

// 获取北京时间
function getBeijingTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 3600 * 1000);
}

function parseTime(s) {
  if (!s) return null;
  const t = new Date(s.replace(/-/g, '/'));
  return isNaN(t.getTime()) ? null : t;
}

// 从后端获取课程数据（保持你原来的接口调用）
async function fetchCourses() {
  try {
    const res = await fetch("https://qcbldekt.bit.edu.cn/api/course/list?page=1&limit=60&transcript_index_id=0&transcript_index_type_id=", {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Accept": "*/*"
      }
    });
    const data = await res.json();
    if (data.code === 200 && data.data && data.data.items) {
      return data.data.items.map(c => ({
        id: c.id,
        title: c.title,
        sign_in_start_time: c.sign_in_start_time,
        sign_in_end_time: c.sign_in_end_time,
        sign_out_start_time: c.sign_out_start_time,
        sign_out_end_time: c.sign_out_end_time
      }));
    }
    return [];
  } catch (err) {
    console.error("获取课程失败:", err);
    return [];
  }
}

// ---------- 新增：将百分比时间映射为 axis 上的像素位置 ----------
// 说明：保持原有百分比（hours/24*100），但把结果映射到 axis 元素的可见范围，
// 这样能消除 grid/padding/left-column 导致的视觉偏移。
function percentToAxisPixels(percent) {
  // 获取 axis 在视口中的位置和宽度
  const axisRect = axisEl.getBoundingClientRect();
  // 获取 timeline-container 的左边界（currentTimeLine 是相对于 timeline-container 绝对定位）
  const timelineContainer = axisEl.closest(".timeline-container") || document.querySelector(".timeline-container");
  const containerRect = timelineContainer.getBoundingClientRect();

  // 计算 axis 在 container 内的相对左边（像素）
  const axisLeftRelativeToContainer = axisRect.left - containerRect.left;

  // 计算像素位置（基于 axis 宽度）
  const x = axisLeftRelativeToContainer + (percent / 100) * axisRect.width;

  return x; // 相对于 timeline-container 的像素位置
}

// 更新 currentTimeLine 的位置（像素方式）
function updateCurrentTimeLinePositionByPercent(percent) {
  if (!currentTimeLine) return;
  const x = percentToAxisPixels(percent);
  // 把 currentTimeLine 放在 timeline-container（你的 HTML 不变，元素仍在 container 中）
  // 使用 px 定位可避免 % 在不同参照物导致的偏移
  currentTimeLine.style.left = Math.round(x) + "px";
  currentTimeLine.style.display = "block";
}

// 主渲染函数（参考并保留你原有逻辑）
async function renderTimeline(selectedDate = null) {
  coursesContainer.innerHTML = "";
  ticksEl.innerHTML = "";
  // currentTimeLine 仍存在于 DOM（不移动它），先隐藏
  if (currentTimeLine) currentTimeLine.style.display = "none";

  if (!selectedDate) {
    const today = getBeijingTime();
    selectedDate = today.toISOString().split("T")[0];
    const df = document.getElementById("dateFilter");
    if (df) df.value = selectedDate;
  }

  // 保持你原来的日期构造方式（不改变逻辑）
  const dayStart = new Date(selectedDate + "T00:00:00");
  const dayEnd = new Date(selectedDate + "T23:59:59");

  // 绘制刻度
  const ticksCount = 25;
  for (let i = 0; i < ticksCount; i++) {
    const tick = document.createElement("div");
    tick.textContent = i.toString().padStart(2, '0') + ":00";
    tick.style.position = "relative";
    ticksEl.appendChild(tick);

    const tickPoint = document.createElement("div");
    tickPoint.className = "tick-point";
    tickPoint.style.left = (i / (ticksCount - 1) * 100) + "%";
    axisEl.appendChild(tickPoint);
  }

  // 获取课程数据
  const courses = await fetchCourses();

  const coursesOnDay = courses.filter(c => {
    const times = [c.sign_in_start_time, c.sign_in_end_time, c.sign_out_start_time, c.sign_out_end_time].map(parseTime);
    return times.some(t => t && t >= dayStart && t <= dayEnd);
  });

  if (coursesOnDay.length === 0) {
    coursesContainer.innerHTML = "<p style='text-align:center'>该日期暂无课程</p>";
    return;
  }

  coursesOnDay.forEach(c => {
    const row = document.createElement("div");
    row.className = "course-row";

    const nameEl = document.createElement("div");
    nameEl.className = "course-name";
    nameEl.title = c.title;
    nameEl.textContent = `[${c.id}] ${c.title}`;
    row.appendChild(nameEl);

    const viz = document.createElement("div");
    viz.className = "course-viz";

    const addBar = (startStr, endStr, className, label) => {
      let start = parseTime(startStr);
      let end = parseTime(endStr);
      if (!start || !end) return;
      if (start < dayStart) start = dayStart;
      if (end > dayEnd) end = dayEnd;

      const bar = document.createElement("div");
      bar.className = "bar " + className;

      const totalMs = dayEnd.getTime() - dayStart.getTime();
      const leftPercent = ((start.getTime() - dayStart.getTime()) / totalMs) * 100;
      const widthPercent = ((end.getTime() - start.getTime()) / totalMs) * 100;

      // 保持你原先用百分比的方式绘制 bar（不改动视觉逻辑）
      bar.style.left = leftPercent + "%";
      bar.style.width = widthPercent + "%";
      bar.textContent = label;

      bar.dataset.title = c.title;
      bar.dataset.label = label;
      bar.dataset.time = `${start.toLocaleTimeString()} → ${end.toLocaleTimeString()}`;
      bar.addEventListener("mouseenter", e => {
        tooltip.style.display = "block";
        tooltip.innerHTML = `<strong>${bar.dataset.title}</strong><br>${bar.dataset.label}<br>${bar.dataset.time}`;
        tooltip.style.left = e.pageX + 10 + "px";
        tooltip.style.top = e.pageY - 20 + "px";
      });
      bar.addEventListener("mouseleave", () => tooltip.style.display = "none");
      viz.appendChild(bar);
    };

    addBar(c.sign_in_start_time, c.sign_in_end_time, "signin", "签到");
    addBar(c.sign_out_start_time, c.sign_out_end_time, "signout", "签退");

    row.appendChild(viz);
    coursesContainer.appendChild(row);
  });

  // 当前时间线显示（北京时间）
  const now = getBeijingTime();
  if (now >= dayStart && now <= dayEnd) {
    const totalMs = dayEnd.getTime() - dayStart.getTime();
    const leftPercent = ((now.getTime() - dayStart.getTime()) / totalMs) * 100;

    // 这里不再直接用百分比设置 left%，而是把百分比映射为 axis 上的像素位置
    updateCurrentTimeLinePositionByPercent(leftPercent);
  }
}

// 初始化渲染
renderTimeline();
document.getElementById("dateFilter").addEventListener("change", e => {
  renderTimeline(e.target.value);
});

// 每分钟更新一次当前时间线（并重新计算像素位置）
setInterval(() => {
  // 只需要更新 currentTimeLine 的位置（避免重复 fetch）
  // 但是为了保持和你的原逻辑完全一致，我们再调用 renderTimeline 以刷新页面内容
  // 如果你想仅更新红线，可以换成单独的更新函数
  const selected = document.getElementById("dateFilter").value;
  renderTimeline(selected);
}, 60000);

// 当窗口大小改变时重新计算 currentTimeLine 的像素位置（避免响应式布局导致偏移）
window.addEventListener("resize", () => {
  // 重新绘制红线位置（不必再次 fetch）；直接重-run renderTimeline 会更保险
  const selected = document.getElementById("dateFilter").value;
  renderTimeline(selected);
});