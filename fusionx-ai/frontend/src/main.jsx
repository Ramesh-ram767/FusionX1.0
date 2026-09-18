import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

function App() {
  const [model, setModel] = React.useState('clip');
  const [text, setText] = React.useState('Road damage near a bus stop and flooded street');
  const [labels, setLabels] = React.useState('pothole, damaged road, garbage, flooded road, broken streetlight, normal road, water leakage');
  const [image, setImage] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [healthStatus, setHealthStatus] = React.useState(null);

  React.useEffect(() => {
    fetch('/api/ai-health')
      .then((res) => res.json())
      .then((data) => setHealthStatus(data))
      .catch((err) => setHealthStatus({ success: false, error: err.message }));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('model', model);
    formData.append('text', text);
    formData.append('labels', labels);
    if (image) formData.append('image', image);

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Prediction failed');
      }
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: String(error.message || error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Civic AI pipeline</p>
          <h1>CIVIC AI ENGINE</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.85rem' }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: '999px',
            backgroundColor: '#10b98122',
            color: '#10b981',
            border: '1px solid #10b98155',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            Node Backend: 3001
          </span>
          <span style={{
            padding: '4px 10px',
            borderRadius: '999px',
            backgroundColor: healthStatus?.ai_engine === 'connected' ? '#3b82f622' : '#f59e0b22',
            color: healthStatus?.ai_engine === 'connected' ? '#3b82f6' : '#f59e0b',
            border: `1px solid ${healthStatus?.ai_engine === 'connected' ? '#3b82f655' : '#f59e0b55'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: healthStatus?.ai_engine === 'connected' ? '#3b82f6' : '#f59e0b'
            }}></span>
            FastAPI: {healthStatus?.ai_engine === 'connected' ? `Connected (${healthStatus.latency_ms}ms)` : 'Checking...'}
          </span>
        </div>
      </header>

      <div className="flow-diagram">
        <div className="node citizen">Citizen Problem</div>
        <div className="branch-row">
          <div className="node small">TEXT</div>
          <div className="node small">IMAGE</div>
          <div className="node small">LOCATION</div>
        </div>
        <div className="branch-row models-row">
          <div className="node model">BART</div>
          <div className="node model">CLIP</div>
          <div className="node model">YOLO</div>
          <div className="node model">BLIP</div>
          <div className="node model">DINOv2</div>
        </div>
        <div className="node response">AI RESPONSE</div>
      </div>

      <form className="panel" onSubmit={handleSubmit}>
        <div className="field-row">
          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="clip">CLIP (zero-shot image classification)</option>
              <option value="yolo">YOLOv11 (object detection)</option>
              <option value="blip">BLIP (image captioning)</option>
              <option value="text">BART (zero-shot text classification)</option>
              <option value="embedding">DINOv2 (768-dim visual embedding)</option>
            </select>
          </label>
        </div>

        <div className="field-row">
          <label>
            Problem text
            <textarea
              rows="4"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        </div>

        <div className="field-row">
          <label>
            Candidate labels
            <textarea
              rows="3"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
            />
          </label>
        </div>

        <div className="field-row">
          <label>
            Upload image
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} />
          </label>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Running models...' : 'Run civic analysis'}
        </button>
      </form>

      <section className="results panel">
        <h2>Model Output</h2>
        {!result && <p>Submit a case to inspect the civic AI reasoning.</p>}

        {result && !result.success && (
          <pre>{result.error || 'Prediction failed'}</pre>
        )}

        {result && result.success && (
          <div className="json-block">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
