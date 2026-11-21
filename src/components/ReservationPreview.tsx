export function ReservationPreview() {
  return <section id="reservations" className="reservation-section" aria-labelledby="reservation-heading">
    <div><h2 id="reservation-heading">A seat at our table.</h2><p>Long lunches, quiet celebrations, and evenings that take their time. There’s room for every occasion.</p></div>
    <div className="reservation-preview"><span className="status">Preview only</span><h3>Your next gathering</h3><p id="reservation-note">Online reservations are coming in a future phase. This demo cannot check availability or book a table.</p>
      <fieldset disabled aria-describedby="reservation-note"><legend>Sample reservation details</legend><div className="preview-fields"><label>Date<input type="date" /></label><label>Guests<select defaultValue="2"><option value="2">2 guests</option><option value="4">4 guests</option><option value="6">6 guests</option></select></label></div><button className="button" type="button" disabled>Reservations coming soon</button></fieldset>
      <p className="small-print">No information is collected or saved.</p>
    </div>
  </section>
}

