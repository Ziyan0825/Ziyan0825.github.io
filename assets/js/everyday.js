(function () {
  "use strict";

  var root = document.querySelector("[data-everyday]");
  var dataNode = document.getElementById("everyday-data");

  if (!root || !dataNode) {
    return;
  }

  var data = {};
  try {
    data = JSON.parse(dataNode.textContent || "{}");
  } catch (error) {
    data = {};
  }

  var githubCache = {};
  var sparkleTimer = null;
  var lang = root.getAttribute("data-everyday-lang") || "en";
  var copy = lang === "zh" ? {
    loading: "正在加载 ",
    live: "GitHub 实时数据 ",
    local: "本地预览 ",
    contribution: " 次贡献",
    contributions: " 次贡献",
    rest: "休息",
    basketball: "篮球",
    strength: "力量训练",
    both: "篮球和力量训练"
  } : {
    loading: "Loading ",
    live: "Live GitHub ",
    local: "Local preview ",
    contribution: " contribution",
    contributions: " contributions",
    rest: "rest",
    basketball: "basketball",
    strength: "strength",
    both: "basketball and strength"
  };
  var githubSelect = root.querySelector('[data-everyday-year="github"]');
  var exerciseSelect = root.querySelector('[data-everyday-year="exercise"]');

  renderExercise();
  renderGitHubForSelectedYear();
  bindYearControls();
  startSparkles();

  function bindYearControls() {
    if (githubSelect) {
      githubSelect.addEventListener("change", renderGitHubForSelectedYear);
    }

    if (exerciseSelect) {
      exerciseSelect.addEventListener("change", renderExercise);
    }
  }

  function selectedYear(selectNode, fallbackYear) {
    if (!selectNode || !selectNode.value) {
      return fallbackYear;
    }

    return Number(selectNode.value);
  }

  function buildYearDays(year) {
    var start = new Date(year, 0, 1);
    var end = new Date(year, 11, 31);
    start.setDate(start.getDate() - start.getDay());
    end.setDate(end.getDate() + (6 - end.getDay()));

    var days = [];
    var cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  function toISO(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function formatDate(isoDate) {
    var parts = isoDate.split("-");
    return parts[1] + "/" + parts[2] + "/" + parts[0];
  }

  function monthName(date) {
    return date.toLocaleString("en-US", { month: "short" });
  }

  function renderMonthLabels(type, days, weekCount, year) {
    var labelRow = root.querySelector('[data-everyday-months="' + type + '"]');
    if (!labelRow) {
      return;
    }

    labelRow.innerHTML = "";
    labelRow.style.gridTemplateColumns = "repeat(" + weekCount + ", var(--cell-size))";

    days.forEach(function (date, index) {
      if (date.getFullYear() !== year || date.getDate() !== 1) {
        return;
      }

      var label = document.createElement("span");
      label.textContent = monthName(date);
      label.style.gridColumn = Math.floor(index / 7) + 1 + " / span 4";
      labelRow.appendChild(label);
    });
  }

  function renderGrid(type, year, resolver) {
    var grid = root.querySelector('[data-everyday-grid="' + type + '"]');
    if (!grid) {
      return;
    }

    var days = buildYearDays(year);
    var weekCount = Math.ceil(days.length / 7);

    renderMonthLabels(type, days, weekCount, year);
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = "repeat(" + weekCount + ", var(--cell-size))";

    days.forEach(function (date) {
      var iso = toISO(date);
      var isCurrentYear = date.getFullYear() === year;
      var cellState = resolver(iso, date, isCurrentYear);
      var cell = document.createElement("span");
      cell.className = "contribution-cell " + cellState.className + (isCurrentYear ? "" : " outside-year");
      cell.setAttribute("title", cellState.title);
      cell.setAttribute("aria-label", cellState.title);
      grid.appendChild(cell);
    });
  }

  function renderGitHubForSelectedYear() {
    var year = selectedYear(githubSelect, 2026);
    setText("[data-everyday-github-source]", copy.loading + year);

    loadGitHubContributions(year)
      .then(function (contributionData) {
        renderGitHub(year, contributionData);
      })
      .catch(function () {
        renderGitHub(year, buildFallbackGitHub(year));
      });
  }

  function loadGitHubContributions(year) {
    if (githubCache[year]) {
      return githubCache[year];
    }

    var config = data.github || {};
    var username = config.username || "";
    var apiBase = (config.api_base || "https://github-contributions-api.jogruber.de/v4").replace(/\/$/, "");

    if (!username || !window.fetch) {
      return Promise.reject(new Error("GitHub calendar unavailable"));
    }

    githubCache[year] = fetch(apiBase + "/" + encodeURIComponent(username) + "?y=" + year, {
      cache: "force-cache"
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("GitHub calendar request failed");
        }
        return response.json();
      })
      .then(function (payload) {
        var normalized = normalizeGitHubPayload(payload, year);
        normalized.source = copy.live + year;
        return normalized;
      });

    return githubCache[year];
  }

  function normalizeGitHubPayload(payload, year) {
    var rows = [];
    var map = new Map();

    if (Array.isArray(payload.contributions)) {
      rows = payload.contributions;
    } else if (Array.isArray(payload.years)) {
      payload.years.forEach(function (yearRecord) {
        if (Array.isArray(yearRecord.contributions)) {
          rows = rows.concat(yearRecord.contributions);
        }
      });
    }

    rows.forEach(function (item) {
      var iso = item.date;
      var count = Number(item.count || item.contributionCount || 0);
      if (!iso || Number(iso.slice(0, 4)) !== year) {
        return;
      }
      map.set(iso, count);
    });

    return {
      map: map,
      source: "Live GitHub " + year
    };
  }

  function buildFallbackGitHub(year) {
    var map = new Map();
    var days = buildYearDays(year);

    days.forEach(function (date, index) {
      if (date.getFullYear() !== year) {
        return;
      }

      var weekday = date.getDay();
      var signature = (index * 17 + date.getDate() * 11 + (date.getMonth() + 1) * 7 + year) % 29;
      var count = 0;

      if (weekday !== 0 && weekday !== 6) {
        if (signature > 23) {
          count = 8 + (signature % 5);
        } else if (signature > 18) {
          count = 4 + (signature % 4);
        } else if (signature > 11) {
          count = 1 + (signature % 3);
        }
      } else if (signature > 25) {
        count = 1;
      }

      map.set(toISO(date), count);
    });

    return {
      map: map,
      source: copy.local + year
    };
  }

  function renderGitHub(year, contributionData) {
    var codingDays = 0;

    renderGrid("github", year, function (iso, date, isCurrentYear) {
      var count = isCurrentYear ? contributionData.map.get(iso) || 0 : 0;
      var level = githubLevel(count);

      if (count > 0) {
        codingDays += 1;
      }

      return {
        className: "github-level-" + level + (count > 0 ? " is-active" : ""),
        title: formatDate(iso) + ": " + count + (count === 1 ? copy.contribution : copy.contributions)
      };
    });

    setText("[data-everyday-coding-days]", codingDays);
    setText("[data-everyday-github-source]", contributionData.source);
  }

  function githubLevel(count) {
    if (count <= 0) {
      return 0;
    }
    if (count <= 2) {
      return 1;
    }
    if (count <= 5) {
      return 2;
    }
    if (count <= 9) {
      return 3;
    }
    return 4;
  }

  function renderExercise() {
    var year = selectedYear(exerciseSelect, 2026);
    var entries = ((data.exercise || {}).entries || []);
    var map = new Map();

    entries.forEach(function (entry) {
      if (!entry.date || Number(entry.date.slice(0, 4)) !== year) {
        return;
      }

      var current = map.get(entry.date) || { basketball: false, strength: false };
      current.basketball = current.basketball || entry.basketball === true;
      current.strength = current.strength || entry.strength === true;
      map.set(entry.date, current);
    });

    var totals = {
      active: 0,
      basketball: 0,
      strength: 0,
      both: 0
    };

    renderGrid("exercise", year, function (iso, date, isCurrentYear) {
      var entry = isCurrentYear ? map.get(iso) || { basketball: false, strength: false } : { basketball: false, strength: false };
      var className = "exercise-empty";
      var label = copy.rest;

      if (entry.basketball && entry.strength) {
        className = "exercise-both is-active";
        label = copy.both;
        totals.both += 1;
      } else if (entry.basketball) {
        className = "exercise-basketball is-active";
        label = copy.basketball;
      } else if (entry.strength) {
        className = "exercise-strength is-active";
        label = copy.strength;
      }

      if (entry.basketball || entry.strength) {
        totals.active += 1;
      }
      if (entry.basketball) {
        totals.basketball += 1;
      }
      if (entry.strength) {
        totals.strength += 1;
      }

      return {
        className: className,
        title: formatDate(iso) + ": " + label
      };
    });

    setText("[data-everyday-workout-days]", totals.active);
    setText("[data-everyday-basketball-days]", totals.basketball);
    setText("[data-everyday-strength-days]", totals.strength);
    setText("[data-everyday-both-days]", totals.both);
  }

  function setText(selector, value) {
    var node = root.querySelector(selector);
    if (node) {
      node.textContent = value;
    }
  }

  function startSparkles() {
    if (sparkleTimer) {
      window.clearTimeout(sparkleTimer);
    }

    function sparkleOnce() {
      var sparkleCells = root.querySelectorAll(".github-level-4.is-active, .exercise-both.is-active");
      if (sparkleCells.length) {
        var cell = sparkleCells[Math.floor(Math.random() * sparkleCells.length)];
        cell.classList.add("is-sparkling");
        window.setTimeout(function () {
          cell.classList.remove("is-sparkling");
        }, 720);
      }

      sparkleTimer = window.setTimeout(sparkleOnce, 180 + Math.random() * 420);
    }

    sparkleTimer = window.setTimeout(sparkleOnce, 650);
  }
})();
