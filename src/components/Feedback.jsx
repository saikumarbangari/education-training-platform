export default function Feedback({
  tone = "info",
  title,
  children,
  action,
  headingLevel = "h2",
}) {
  const Heading = headingLevel;

  return (
    <section
      className={`feedback feedback--${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div>
        <Heading>{title}</Heading>
        {children}
      </div>
      {action}
    </section>
  );
}
