interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
}

export default function Avatar({ username, avatarUrl, size = "sm" }: AvatarProps) {
  return (
    <div className={`avatar avatar--${size}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={username} className="avatar-img" />
      ) : (
        <span className="avatar-initials">{username ? username[0].toUpperCase() : "?"}</span>
      )}
    </div>
  );
}
