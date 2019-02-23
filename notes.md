# PostgreSQL/PostGIS notes:

- Dockerized PostgreSQL with PostGIS option:

   - Initialize:
   
         $ docker volume create postgresql_data
         $ docker run \
               --name=postgresql-with-postgis -d \
               -e POSTGRES_USER=user_name \
               -e POSTGRES_PASS=user_pass \
               -e ALLOW_IP_RANGE=0.0.0.0/0 -p 5433:5432 \
               -v postgresql_data:/var/lib/postgresql \
               --restart=always \
               kartoza/postgis:9.6-2.4
           
   - Connect to the default (`postgres`) database: `psql -h localhost -U user_name -d postgres`.
   - Create a new database: `CREATE DATABASE database_name;`
   
   - <strong>To enable PostGIS on the new database</strong>:
        
      - Switch to the database: `\connect database_name`
      - Create PostGIS extension: `CREATE EXTENSION postgis;`

# Linux Mint Notes:

## Start Up Commands:

 * Kill bluetooth on stratup: `rfkill block bluetooth`
 * WiFi power management: 
    * Check if it is on: `iwconfig`
    * Stop Power Management: `sudo /sbin/iwconfig wlp6s0 power off`
