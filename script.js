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

// 从后端获取课程数据
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
      // 映射成前端需要的格式
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

async function renderTimeline(selectedDate = null) {
  coursesContainer.innerHTML = "";
  ticksEl.innerHTML = "";
  currentTimeLine.style.display = "none";

  if (!selectedDate) {
    const today = getBeijingTime();
    selectedDate = today.toISOString().split("T")[0];
    document.getElementById("dateFilter").value = selectedDate;
  }

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
  // 在课程名称前加上 ID
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
    const left = ((start.getTime() - dayStart.getTime()) / totalMs) * 100;
    const width = ((end.getTime() - start.getTime()) / totalMs) * 100;

    bar.style.left = left + "%";
    bar.style.width = width + "%";
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
    const left = ((now.getTime() - dayStart.getTime()) / totalMs) * 100;
    currentTimeLine.style.left = left + "%";
    currentTimeLine.style.display = "block";
  }
}

// 初始化渲染
renderTimeline();
document.getElementById("dateFilter").addEventListener("change", e => {
  renderTimeline(e.target.value);
});

// 每分钟更新一次当前时间线
setInterval(() => {
  renderTimeline(document.getElementById("dateFilter").value);
}, 60000);
