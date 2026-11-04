export function ErrorList({ errors }: { errors: Record<string, string> }) {
  return (
    <div role="alert">
      {Object.entries(errors).map(([key, message]) => (
        <p className="error" key={key}>
          {message}
        </p>
      ))}
    </div>
  );
}
