while true
do 
	java -jar SpotifyDiscoveryBot.jar /home/pi/Schreibtisch/spotifybot/database.db
	echo "Bot halted. Restarting in 10 seconds..."
	sleep 10
done