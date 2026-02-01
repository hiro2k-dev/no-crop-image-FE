import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  return (
    <div className="home-container">
      <div className="home-hero">
        <h1 className="home-title">Image Tools</h1>
        <p className="home-subtitle">Professional image processing made simple</p>
      </div>

      <div className="features-grid">
        <Link to="/nocrop" className="feature-card">
          <div className="feature-icon">NC</div>
          <h2 className="feature-title">No-Crop Tool</h2>
          <p className="feature-description">
            Add padding to your images without cropping. Perfect for Instagram, social media, and more.
          </p>
          <div className="feature-highlights">
            <span className="highlight-badge">Multiple Ratios</span>
            <span className="highlight-badge">Batch Process</span>
            <span className="highlight-badge">Custom Colors</span>
          </div>
        </Link>

        <Link to="/layout" className="feature-card">
          <div className="feature-icon">LC</div>
          <h2 className="feature-title">Layout Creator</h2>
          <p className="feature-description">
            Create stunning photo collages with 2-3 images. Customize layout, zoom, and positioning.
          </p>
          <div className="feature-highlights">
            <span className="highlight-badge">2-3 Images</span>
            <span className="highlight-badge">Drag & Drop</span>
            <span className="highlight-badge">Custom Zoom</span>
          </div>
        </Link>
      </div>

      <div className="home-footer">
      </div>
    </div>
  );
}

export default Home;
