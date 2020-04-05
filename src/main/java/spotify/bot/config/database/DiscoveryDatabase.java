package spotify.bot.config.database;

import java.io.File;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Collection;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import spotify.Main;
import spotify.bot.util.BotLogger;

@Repository
public class DiscoveryDatabase {

	// Database base constants
	private final static String DB_FILE_NAME = "database.db";
	private final static String DB_URL_PREFIX = "jdbc:sqlite:";

	// Database query masks
	private final static String SINGLE_SELECT_QUERY_MASK = "SELECT * FROM %s LIMIT 1";
	private final static String FULL_SELECT_QUERY_MASK = "SELECT * FROM %s";
	private final static String INSERT_QUERY_MASK = "INSERT INTO %s(%s) VALUES('%s')";
	private final static String DELETE_QUERY_MASK = "DELETE FROM %s WHERE %s = '%s'";
	private final static String UPDATE_QUERY_MASK = "UPDATE %s SET %s = '%s'";
	private final static String UPDATE_WITH_CONDITION_QUERY_MASK = "UPDATE %s SET %s = %s WHERE %s = '%s'";

	// Instance
	private final static File WORKSPACE_LOCATION = new File(".");

	@Autowired
	private BotLogger log;

	private String dbUrl;
	private Connection connection;

	@PostConstruct
	private void init() throws IOException, SQLException {
		File setDbFilePath = null;

		File alternateDatabaseFilepath = Main.getAlternateDatabaseFilePath();
		if (alternateDatabaseFilepath != null && !alternateDatabaseFilepath.canRead()) {
			throw new IOException("Could not access alternate SQLite database file! Set location: " + alternateDatabaseFilepath.getAbsolutePath());
		} else if (alternateDatabaseFilepath != null && alternateDatabaseFilepath.canRead() && alternateDatabaseFilepath.getName().endsWith(".db")) {
			setDbFilePath = alternateDatabaseFilepath;
		} else {
			File workingDirectoryDatabaseFilepath = new File(WORKSPACE_LOCATION, DB_FILE_NAME);
			if (workingDirectoryDatabaseFilepath == null || !workingDirectoryDatabaseFilepath.canRead() || !workingDirectoryDatabaseFilepath.getName().endsWith(".db")) {
				throw new IOException(String.format("Could not find SQLite database file! Generated location was: WORKDIR[%s] or ALTERNATE[%s]",
					workingDirectoryDatabaseFilepath.getAbsolutePath(),
					alternateDatabaseFilepath.getAbsolutePath()));
			}
			setDbFilePath = workingDirectoryDatabaseFilepath;
		}
		this.dbUrl = DB_URL_PREFIX + setDbFilePath.getAbsolutePath();
		log.info("Using SQLite database located at: " + setDbFilePath.getAbsolutePath());
	}

	//////////////

	/**
	 * Returns the Database connection instance. May create a new one if not already
	 * set
	 */
	private Connection getConnectionInstance() throws SQLException {
		if (connection == null || connection.isClosed()) {
			connection = DriverManager.getConnection(dbUrl);
		}
		return connection;
	}

	/**
	 * Close the SQL connection if it's still live
	 */
	@PreDestroy
	private void closeConnection() throws SQLException {
		if (connection != null) {
			connection.close();
		}
	}

	/**
	 * Creates a new Database statement. May create a new database instance.
	 * 
	 * @return
	 */
	private Statement createStatement() throws SQLException {
		return getConnectionInstance().createStatement();
	}

	//////////////

	/**
	 * Fetch the single-row result set of the given table
	 */
	ResultSet selectSingle(String tableName) throws SQLException, IOException {
		ResultSet rs = createStatement().executeQuery(String.format(SINGLE_SELECT_QUERY_MASK, tableName));
		return rs;
	}

	/**
	 * Fetch an entire table result set
	 * 
	 * @param tableName
	 * @return
	 */
	ResultSet selectAll(String tableName) throws SQLException {
		ResultSet rs = createStatement().executeQuery(String.format(FULL_SELECT_QUERY_MASK, tableName));
		return rs;
	}

	////////////////

	/**
	 * Update every given column's value in the given table by a new value
	 * 
	 * @param table
	 * @param targetColumn
	 * @param newValue
	 */
	synchronized void update(String table, String targetColumn, String newValue) throws SQLException {
		createStatement().executeUpdate(String.format(UPDATE_QUERY_MASK, table, targetColumn, newValue));
	}

	synchronized void updateWithCondition(String table, String targetColumn, String newValue, String conditionColumn, String conditionValue) throws SQLException {
		createStatement().executeUpdate(String.format(UPDATE_WITH_CONDITION_QUERY_MASK, table, targetColumn, newValue, conditionColumn, conditionValue));
	}

	synchronized void updateNull(String table, String targetColumn, String conditionColumn, String conditionValue) throws SQLException {
		updateWithCondition(table, targetColumn, null, conditionColumn, conditionValue);
	}

	/**
	 * Adds all given strings to the specified table's specified column
	 * 
	 * @param strings
	 * @param table
	 * @param column
	 */
	synchronized void insertAll(Collection<String> strings, String table, String column) throws SQLException {
		if (table != null && column != null && strings != null && !strings.isEmpty()) {
			for (String s : strings) {
				createStatement().executeUpdate(String.format(INSERT_QUERY_MASK, table, column, s));
			}
		}
	}

	/**
	 * Removes all given strings from the specified table's specified column
	 * 
	 * @param stringsToRemove
	 * @param table
	 * @param column
	 */
	synchronized void deleteAll(Collection<String> stringsToRemove, String table, String column) throws SQLException {
		if (table != null && column != null && stringsToRemove != null && !stringsToRemove.isEmpty()) {
			for (String s : stringsToRemove) {
				createStatement().execute(String.format(DELETE_QUERY_MASK, table, column, s));
			}
		}
	}
}
