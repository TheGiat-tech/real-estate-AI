import Section from './components/Section';
import Form from './components/Form';
export default function Page(){
  return (
    <div className="space-y-6">
      <Section title="Analyze a Property">
        <p className="muted">Upload a property photo + enter address → AI detects damage (Roboflow), pulls home data (Zillow via RapidAPI), estimates rehab & ARV, and lets you save a contractor-style report.</p>
        <div className="mt-4"><Form/></div>
      </Section>
    </div>
  );
}
