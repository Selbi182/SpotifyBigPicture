package spotify.site;

import org.apache.hc.core5.net.URIBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.ModelAndView;

@RestController
public class ViewController {

  @GetMapping("/")
  public ModelAndView createSpotifyPlaybackInterfaceView() {
    URIBuilder uriBuilder = new URIBuilder();
    uriBuilder.setPath("/layout.html");
    ModelAndView modelAndView = new ModelAndView();
    modelAndView.setViewName(uriBuilder.toString());
    return modelAndView;
  }
}
