import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';
const REPO = 'saketh123b/portfolio';

// Shared at module level so helpers can use them
let xScale;
let yScale;
let commits;
let filteredCommits;
let colors = d3.scaleOrdinal(d3.schemeTableau10);


/* ---------- Step 1.1: load data ---------- */
async function loadData() {
  return await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
}
function renderFiles(filteredData) {
  const files = d3
    .groups(filteredData, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join((enter) =>
      enter.append('div').call((div) => {
        const dt = div.append('dt');
        dt.append('code');
        dt.append('small');
        div.append('dd');
      }),
    );

  filesContainer.select('dt > code').text((d) => d.name);
  filesContainer.select('dt > small').text((d) => `${d.lines.length} lines`);

  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

/* ---------- Step 1.2: commit data ---------- */
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: `https://github.com/${REPO}/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      // Hidden from console.log / Object.keys, but still accessible
      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: true,
        writable: true,
        enumerable: false,
      });

      return ret;
    });
}

/* ---------- Step 1.3: summary stats ---------- */
function renderCommitInfo(data, commits) {
  // Clear the previous render so stats don't pile up on every slider move
  d3.select('#stats').selectAll('*').remove();
  if (commits.length === 0) return;

  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  const add = (label, value, html = false) => {
    const dt = dl.append('dt');
    html ? dt.html(label) : dt.text(label);
    dl.append('dd').text(value);
  };

  add('Total <abbr title="Lines of code">LOC</abbr>', data.length, true);
  add('Total commits', commits.length);

  // Number of distinct files
  add('Number of files', d3.group(data, (d) => d.file).size);

  // Grouped aggregate: length (in lines) of each file
  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  add('Maximum file length (lines)', d3.max(fileLengths, (d) => d[1]));
  add('Average file length (lines)', d3.mean(fileLengths, (d) => d[1]).toFixed(1));
  add('Longest file', d3.greatest(fileLengths, (d) => d[1])?.[0]);

  // Whole-dataset aggregates
  add('Average line length (chars)', d3.mean(data, (d) => d.length).toFixed(1));
  add('Maximum depth', d3.max(data, (d) => d.depth));

  // Min/max-style: when most work happens
  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en', { dayPeriod: 'short' }),
  );
  add('Most active time of day', d3.greatest(workByPeriod, (d) => d[1])?.[0]);

  const workByWeekday = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en', { weekday: 'long' }),
  );
  add('Most active day of week', d3.greatest(workByWeekday, (d) => d[1])?.[0]);
}

/* ---------- Step 3: tooltip helpers ---------- */
function renderTooltipContent(commit) {
  if (Object.keys(commit).length === 0) return;

  const link = document.getElementById('commit-link');
  link.href = commit.url;
  link.textContent = commit.id;

  document.getElementById('commit-date').textContent =
    commit.datetime?.toLocaleString('en', { dateStyle: 'full' });
  document.getElementById('commit-time').textContent =
    commit.datetime?.toLocaleString('en', { timeStyle: 'short' });
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  document.getElementById('commit-tooltip').hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;
}

/* ---------- Step 5: brushing helpers ---------- */
function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  // Only count commits that are currently visible (filtered by the slider)
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  document.querySelector('#selection-count').textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}
  

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  container.innerHTML = '';
  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);
    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function createBrushSelector(svg, width, height) {
  svg.call(
    d3
      .brush()
      .extent([
        [0, 0],
        [width, height],
      ])
      .on('start brush end', brushed),
  );

  // Put dots (and everything after the overlay) above the brush overlay
  // so that hovering/tooltips keep working (Step 5.2)
  svg.selectAll('.dots, .overlay ~ *').raise();
}

/* ---------- Steps 2-4 + slider: scatterplot (draw once, then update) ---------- */
function updateScatterPlot(data, filteredCommits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // Night = blue, day = orange (peaks at noon)
  const timeColor = d3.scaleLinear().domain([0, 1]).range(['steelblue', 'orange']);
  const colorForHour = (hour) => timeColor(1 - Math.abs(12 - hour) / 12);

  // ---- One-time setup: svg, gridlines, y-axis, empty groups, brush ----
  let svg = d3.select('#chart').select('svg');
  if (svg.empty()) {
    svg = d3
      .select('#chart')
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('overflow', 'visible');

    yScale = d3
      .scaleLinear()
      .domain([0, 24])
      .range([usableArea.bottom, usableArea.top]);

    // Gridlines (added BEFORE axes and dots)
    const gridlines = svg
      .append('g')
      .attr('class', 'gridlines')
      .attr('transform', `translate(${usableArea.left}, 0)`);
    gridlines.call(
      d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width),
    );
    gridlines.selectAll('.tick line').attr('stroke', (d) => colorForHour(d));

    svg
      .append('g')
      .attr('transform', `translate(${usableArea.left}, 0)`)
      .call(
        d3
          .axisLeft(yScale)
          .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'),
      );

    svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${usableArea.bottom})`);

    svg.append('g').attr('class', 'dots');

    // Brush must be created after the dots group exists so it can be raised
    createBrushSelector(svg, width, height);
  }

  xScale = d3
    .scaleTime()
    .domain(d3.extent(filteredCommits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(d3.axisBottom(xScale));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const sortedCommits = d3.sort(filteredCommits, (d) => -d.totalLines);

  svg
    .select('g.dots')
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id) // key function: one circle per commit
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', (d) => colorForHour(d.hourFrac))
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

/* ---------- Run ---------- */
const data = await loadData();
// sorted so the story steps come out in date order
commits = d3.sort(processCommits(data), (d) => d.datetime);
filteredCommits = commits;

/* ---------- Time control (slider + scrolling share this) ---------- */
let commitProgress = 100;

let timeScale = d3
  .scaleTime()
  .domain([d3.min(commits, (d) => d.datetime), d3.max(commits, (d) => d.datetime)])
  .range([0, 100]);

let commitMaxTime = timeScale.invert(commitProgress);

const slider = document.getElementById('commit-slider');
const sliderTime = document.getElementById('slider-time');

function updateToTime(time) {
  commitMaxTime = time;
  commitProgress = timeScale(time);

  sliderTime.textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  const filteredData = filteredCommits.flatMap((d) => d.lines);

  renderCommitInfo(filteredData, filteredCommits);
  updateScatterPlot(data, filteredCommits);
  renderFiles(filteredData);
}

function onTimeSliderChange() {
  updateToTime(timeScale.invert(Number(slider.value)));
}

slider.addEventListener('input', onTimeSliderChange);
onTimeSliderChange(); // draws everything the first time

/* ---------- Scrollytelling ---------- */
d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
      On ${d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
      })},
      I made <a href="${d.url}" target="_blank" rel="noopener">${
        i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
      }</a>.
      I edited ${d.totalLines} lines across ${
        d3.rollups(
          d.lines,
          (D) => D.length,
          (f) => f.file,
        ).length
      } files.
      Then I looked over all I had made, and I saw that it was very good.
    `,
  );

function onStepEnter(response) {
  const commit = d3.select(response.element).datum();
  slider.value = timeScale(commit.datetime); // keep the slider in sync
  updateToTime(commit.datetime);
}

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);