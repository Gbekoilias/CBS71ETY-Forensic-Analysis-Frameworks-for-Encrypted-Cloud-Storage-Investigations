// graph_data.js
window.GraphData = (() => {
      function prepareTimelineData(logs, meta) {
        // Combine memory events (tagged in logs), metadata events, and log events
        const events = [];
    
        // 1) Memory‐layer: extract from logs where process==='volatility' or mem_ref
        logs.filter(l => l.memory_ref).forEach((l, i) => {
          events.push({
            timestamp: l.timestamp,
            layer: 'memory',
            layerIndex: 2,
            description: `RAM key extract for ${l.file_id}`
          });
        });
    
        // 2) Log‐layer
        logs.forEach((l, i) => {
          events.push({
            timestamp: l.timestamp,
            layer: 'log',
            layerIndex: 1,
            description: `${l.action} (${l.file_id}) by ${l.user_id}`
          });
        });
    
        // 3) Metadata‐layer
        meta.forEach((m, i) => {
          events.push({
            timestamp: m.timestamp,
            layer: 'metadata',
            layerIndex: 0,
            description: `Metadata update: ${m.file_id} size=${m.size}`
          });
        });
    
        // Sort ascending
        return events.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      }
    
      function prepareAnomalyData(logs) {
        // Filter anomalies and bucket by hour
        const anomalies = logs.filter(l => l.anomaly === true);
        const byHour = {};
        anomalies.forEach(a => {
          const h = new Date(a.timestamp).getUTCHours();
          byHour[h] = (byHour[h] || 0) + 1;
        });
        // Fill 0–23
        const hours = Array.from({length:24}, (_,i)=>i);
        return {
          hours,
          counts: hours.map(h => byHour[h]||0)
        };
      }
    
      function prepareFlowData(enc, logs, meta) {
        const nodes = [], links = [];
        const nodeMap = {};
    
        // Helper to add node
        function addNode(id, label, type) {
          if (!nodeMap[id]) {
            nodeMap[id] = { id, label, type };
            nodes.push(nodeMap[id]);
          }
        }
    
        // 1) Files
        enc.forEach(f => addNode(f.file_id, f.file_id, 'file'));
    
        // 2) Sessions & Users
        logs.forEach(l => {
          addNode(l.session_id, l.session_id, 'session');
          addNode(l.user_id,    l.user_id,    'user');
          // file→session
          links.push({ source: l.file_id, target: l.session_id, weight: 1 });
          // session→user
          links.push({ source: l.session_id, target: l.user_id,    weight: 1 });
        });
    
        // 3) Metadata associations: file→metadata snapshot
        meta.forEach(m => {
          const metaNode = `meta_${m.session_id}_${m.file_id}`;
          addNode(metaNode, `meta`, 'metadata');
          links.push({ source: m.file_id, target: metaNode, weight: 0.5 });
          links.push({ source: metaNode,  target: m.session_id, weight: 0.5 });
        });
    
        return { nodes, links };
      }
    
      return {
        prepareTimelineData,
        prepareAnomalyData,
        prepareFlowData
      };
    })();
    