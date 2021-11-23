package de.selbi.spotify.bot.api.events;

import org.springframework.context.ApplicationEvent;

public class LoggedInEvent extends ApplicationEvent {
	private static final long serialVersionUID = 6985311786329483998L;

	public LoggedInEvent(Object source) {
		super(source);
	}
}
