type Status = "active" | "paused" | "completed" | "archived";

const colorMap: Record<Status, string> = {
  active: "var(--c-accent)",
  paused: "var(--warn)",
  completed: "var(--ok)",
  archived: "var(--mute)",
};

export function StatusDot({
  status,
  size = 8,
}: {
  status: Status;
  size?: number;
}) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        background: colorMap[status],
        opacity: status === "archived" ? 0.4 : 1,
      }}
      aria-label={status}
    />
  );
}
