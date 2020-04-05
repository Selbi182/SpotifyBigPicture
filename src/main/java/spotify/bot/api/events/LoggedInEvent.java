package spotify.bot.api.events;

import org.springframework.context.ApplicationEvent;

public class LoggedInEvent extends ApplicationEvent {
	private static final long serialVersionUID = 1L;

	public LoggedInEvent(Object source) {
		super(source);
	}
}
