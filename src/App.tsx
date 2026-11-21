import { Header, Footer } from './components/Layout'
import { ReservationPreview } from './components/ReservationPreview'
import './App.css'

function App() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="demo-banner">Demo restaurant · Fictional name, menu, location, and opening hours</div>
    <div id="home"><Header /></div>
    <main id="main" tabIndex={-1}>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy"><h1 id="hero-heading">Good food.<br />Better company.</h1><p>A little fire, a lot of heart. Seasonal plates and unhurried moments, shared around the table.</p><div className="hero-actions"><a className="button" href="#reservations">Explore reservations <span aria-hidden="true">?</span></a><a className="text-link" href="#about">Get to know us</a></div><p className="hero-note">Seasonal cooking. A warm welcome. Always.</p></div>
        <div className="hero-art" aria-hidden="true"><div className="plate"><div className="dish"><i /><i /><i /><i /><i /></div></div><span className="art-caption">Made for sharing.</span></div>
      </section>
      <section id="about" className="about-section" aria-labelledby="about-heading"><div><h2 id="about-heading">Simple ingredients.<br />Something special.</h2></div><div><p className="lead">We believe the best meals start with what’s in season and end with one more story.</p><p>At our imagined neighborhood restaurant, bright Mediterranean flavors meet the warmth of a wood-fired kitchen. Think roasted vegetables, fresh herbs, and bread worth passing around.</p><p className="demo-note">A taste of the concept: all dishes and restaurant details on this page are illustrative.</p></div></section>
      <section id="visit" className="visit-section" aria-labelledby="visit-heading"><div><h2 id="visit-heading">Make an evening of it.</h2><p>Come as you are. Stay a little longer.</p><h3>Find our table</h3><address>12 Olive Lane, Garden Quarter<br />Sample City · Fictional address</address><p className="small-print">Demo location only — please do not use for directions.</p></div><div className="hours"><h3>Sample opening hours</h3><dl><div><dt>Monday</dt><dd>Closed</dd></div><div><dt>Tuesday–Thursday</dt><dd>5 pm–10 pm</dd></div><div><dt>Friday–Saturday</dt><dd>12 pm–11 pm</dd></div><div><dt>Sunday</dt><dd>12 pm–9 pm</dd></div></dl><p className="small-print">Illustrative hours for this demo restaurant.</p></div></section>
      <ReservationPreview />
    </main>
    <Footer />
  </>
}
export default App

