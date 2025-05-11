// Entry point: once ReactDOM is ready, mount <Dashboard />
ReactDOM.createRoot(document.getElementById('root')).render(<Dashboard />);
// scripts.js
const { prepareTimelineData, prepareAnomalyData, prepareFlowData } = window.GraphData;

function Dashboard() {
  const [encryptedData, setEncrypted] = React.useState([]);
  const [systemLogs, setLogs]         = React.useState([]);
  const [metadataRecords, setMeta]    = React.useState([]);

  React.useEffect(() => {
    // Fetch all three sources in parallel
    Promise.all([
      fetch('/encrypted_data.json').then(r => r.json()),
      fetch('/system_logs.json').   then(r => r.json()),
      fetch('/metadata.json').      then(r => r.json())
    ]).then(([enc, logs, meta]) => {
      setEncrypted(enc);
      setLogs(logs);
      setMeta(meta);
      // After state updates, we'll call renderers
      setTimeout(renderAll, 0);
    });
  }, []);

  function renderAll() {
    const timelineEvents = prepareTimelineData(systemLogs, metadataRecords);
    renderTimeline('#timeline-chart', timelineEvents);

    const anomalyStats = prepareAnomalyData(systemLogs);
    renderAnomalyChart('anomaly-chart', anomalyStats);

    const flow = prepareFlowData(encryptedData, systemLogs, metadataRecords);
    renderFlowDiagram('#workflow-diagram', flow);
  }

  return (
    <div className="chart-container">
      <div className="chart-box">
        <h2>Session Timeline</h2>
        <div id="timeline-chart"></div>
      </div>
      <div className="chart-box">
        <h2>Anomalous Actions (per hour)</h2>
        <canvas id="anomaly-chart"></canvas>
      </div>
      <div className="chart-box" style={{flex:'1 1 100%'}}>
        <h2>Evidence Flow Diagram</h2>
        <div id="workflow-diagram"></div>
      </div>
    </div>
  );
}

// --- Renderers ---

function renderTimeline(selector, events) {
  // Clear previous
  d3.select(selector).selectAll('*').remove();
  const svg = d3.select(selector)
    .append('svg')
      .attr('width', '100%')
      .attr('height', 300);

  // Time scale
  const times = events.map(e => new Date(e.timestamp));
  const x = d3.scaleTime()
    .domain(d3.extent(times))
    .range([50, window.innerWidth * 0.4]);

  // Draw axes
  svg.append('g')
    .attr('transform','translate(0,250)')
    .call(d3.axisBottom(x).ticks(5));

  // Draw event dots
  svg.selectAll('circle')
    .data(events)
    .enter()
    .append('circle')
      .attr('cx', d => x(new Date(d.timestamp)))
      .attr('cy', d => 250 - (d.layerIndex*40))
      .attr('r', 6)
      .attr('fill', d => d.layer === 'memory' ? '#1f77b4'
                    : d.layer === 'log'   ? '#ff7f0e'
                                          : '#2ca02c')
      .append('title')
        .text(d => `${d.layer.toUpperCase()}: ${d.description}`);
}

function renderAnomalyChart(canvasId, stats) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.hours,
      datasets: [{
        label: 'Anomalies',
        data: stats.counts,
        backgroundColor: 'rgba(220, 20, 60, 0.6)'
      }]
    },
    options: {
      scales: {
        x: { title: { display: true, text: 'Hour of Day' } },
        y: { beginAtZero: true }
      }
    }
  });
}

function renderFlowDiagram(selector, { nodes, links }) {
  d3.select(selector).selectAll('*').remove();
  const width  = window.innerWidth * 0.8;
  const height = 400;
  const svg = d3.select(selector)
    .append('svg').attr('width', width).attr('height', height);

  // Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(150))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width/2, height/2));

  const link = svg.append('g')
    .selectAll('line')
    .data(links)
    .enter().append('line')
      .attr('stroke','#999')
      .attr('stroke-width', d => Math.sqrt(d.weight));

  const node = svg.append('g')
    .selectAll('circle')
    .data(nodes)
    .enter().append('circle')
      .attr('r', 20)
      .attr('fill', d => d.type==='file' ? '#1f77b4'
                    : d.type==='session'    ? '#ff7f0e'
                                             : '#2ca02c')
      .call(drag(simulation))
      .append('title')
        .text(d => `${d.id}\n${d.label}`);

  simulation.on('tick', () => {
    link.attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
    node.attr('cx', d => d.x)
        .attr('cy', d => d.y);
  });
}

function drag(sim) {
  function dragstarted(event, d) {
    if (!event.active) sim.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x; d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) sim.alphaTarget(0);
    d.fx = null; d.fy = null;
  }
  return d3.drag()
      .on('start', dragstarted)
      .on('drag',  dragged)
      .on('end',   dragended);
}
