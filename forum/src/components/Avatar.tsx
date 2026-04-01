interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

export default function Avatar({ username, avatarUrl, size = "sm", onClick }: AvatarProps) {
  return (
    <div className={`avatar avatar--${size}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="avatar-img"
          onClick={onClick}
          style={onClick ? { cursor: "zoom-in" } : undefined}
        />
      ) : (
        <span className="avatar-initials">{username ? username[0].toUpperCase() : "?"}</span>
      )}
    </div>
  );
}
