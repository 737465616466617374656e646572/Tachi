import ProfilePicture from "components/user/ProfilePicture";
import React from "react";
import { Link } from "react-router-dom";
import { UserDocument } from "tachi-common";
import { JustChildren, GamePT } from "types/react";

export default function UserIcon({
	user,
	children,
	game,
	playtype,
}: { user: UserDocument } & Partial<JustChildren> & Partial<GamePT>) {
	return (
		<div className="text-center p-8">
			<ProfilePicture user={user} />
			<h4 className="mt-2">
				<Link
					className="gentle-link"
					to={
						game && playtype
							? `/dashboard/users/${user.username}/games/${game}/${playtype}`
							: `/dashboard/users/${user.username}`
					}
				>
					{user.username}
				</Link>
			</h4>
			{children && <div className="d-flex justify-content-center">{children}</div>}
		</div>
	);
}
