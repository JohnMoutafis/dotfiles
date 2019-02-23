# PostgreSQL/PostGIS notes:

1. Dockerized PostgreSQL:

   - Initial:
   
         $ docker volume create postgresql_data
         $ docker run \
              --name postgres-docker \
              -e POSTGRES_PASSWORD=postgres -d \
              -p 5432:5432 \
              -v postgresql_data:/var/lib/postgresql/data  \
              postgres
           
   - Connect to the database: `psql -h localhost -U postgres`.
   - Create a new user and grant superuser on it:
   
         # CREATE USER username WITH PASSWORD 'user_pass';
         # ALTER USER username WITH superuser;
         
   - Connect as a different user: `psql -h localhost -U username -d postgres`

2. Dockerized PostGIS enabled database command:

    - Initial:
    
          $ docker run \
               --name=container_name -d \
               -e POSTGRES_USER=user_name \
               -e POSTGRES_PASS=user_pass \
               -e POSTGRES_DBNAME=database_name \
               -e ALLOW_IP_RANGE=0.0.0.0/0 -p 5433:5432 \
               -v database_name_volume:/var/lib/postgresql \
               --restart=always \
               kartoza/postgis:9.6-2.4
    - Connect: ` psql -h localhost -p 5433 -U user_name -d database_name`


# Linux Mint Notes:

## Start Up Commands:

 * Kill bluetooth on stratup: `rfkill block bluetooth`
 * WiFi power management: 
    * Check if it is on: `iwconfig`
    * Stop Power Management: `sudo /sbin/iwconfig wlp6s0 power off`
