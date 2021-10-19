package spotify.site;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.ModelAndView;

@RestController
public class ViewController {

	@GetMapping("/")
	public ModelAndView createSpotifyPlaybackInterfaceView(@RequestParam(required = false) String prefs) {
		return createView("layout.html", prefs);
	}

	private ModelAndView createView(String viewFileName, String prefs) {
		ModelAndView modelAndView = new ModelAndView();
		if (prefs != null) {
			viewFileName += "?prefs=" + prefs;
		}
		modelAndView.setViewName(viewFileName);
		return modelAndView;
	}
}