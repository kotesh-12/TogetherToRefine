ALTER USER 'root'@'localhost' IDENTIFIED BY '20050701';
UPDATE mysql.user SET authentication_string=null WHERE User='root';
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY '20050701';
FLUSH PRIVILEGES;
