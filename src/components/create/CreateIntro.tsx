/**
 * Signed-out explanation for /create. This is the only indexable body copy on
 * the page (the workbench needs a session), so it says plainly what the tool
 * does, in the words people search with.
 */
export const createHowItWorks = [
  {
    title: "Describe the colors",
    body: "Write the scheme you have in mind, like “crimson armor with gold trim”, or start from one of our ready-made styles.",
  },
  {
    title: "Upload your kit or pick one",
    body: "Upload a photo, line art or concept image of your Gunpla or mecha, or choose a kit from the catalog. We keep its shape and only change the colors.",
  },
  {
    title: "Preview the repaint and get a paint plan",
    body: "See your kit in the new colors, with a paint plan that matches each color to real paints, before you start spraying.",
  },
] as const;

export const createFaq = [
  {
    question: "What kind of image can I upload?",
    answer: "One clear photo, line art or concept image of a robot or mecha: a built Gunpla, a figure, a sketch or an original design. Use PNG, JPG or WebP, up to 8 MB and 256–4096 px per side.",
  },
  {
    question: "Will my uploaded photo be public?",
    answer: "No. Your photo stays private to your account, even if you publish the finished preview. You can remove it at any time.",
  },
  {
    question: "How many credits does it cost?",
    answer: "Checking an uploaded kit and generating a preview each use credits. The exact cost is shown on the button before you click, and if something fails on our side the credits come back.",
  },
] as const;

export function CreateIntro() {
  return <div className="create-intro">
    <section className="create-intro-steps" aria-labelledby="create-how-title">
      <h2 id="create-how-title">How it works</h2>
      <ol>{createHowItWorks.map((step, index) => <li key={step.title}>
        <span className="create-intro-index" aria-hidden="true">{index + 1}</span>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
      </li>)}</ol>
    </section>
    <section className="create-intro-faq" aria-labelledby="create-faq-title">
      <h2 id="create-faq-title">Common questions</h2>
      <dl>{createFaq.map(item => <div key={item.question}>
        <dt>{item.question}</dt>
        <dd>{item.answer}{item.question.startsWith("How many credits") ? <> <a href="/pricing">See pricing</a></> : null}</dd>
      </div>)}</dl>
    </section>
  </div>;
}
