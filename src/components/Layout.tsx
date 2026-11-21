export function Header() {
  return <header className="site-header">
    <a className="brand" href="#home" aria-label="Ember and Olive home">ember <span>&</span> olive<span className="brand-caption">A NEIGHBORHOOD TABLE</span></a>
    <nav aria-label="Main navigation">
      <a href="#about">Our table</a><a href="#visit">Plan a visit</a><a className="button button-small" href="#reservations">Reservations</a>
    </nav>
  </header>
}

export function Footer() {
  return <footer className="site-footer"><a className="footer-brand" href="#home">ember & olive</a><p>A fictional restaurant. All details are demo content.</p><a href="#home">Back to top ?</a></footer>
}

