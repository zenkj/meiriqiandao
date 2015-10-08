create database mrqd;

use mrqd;

create table users (id int primary key auto_increment,
                    name varchar(40));


create table versions (uid int primary key,
                       version int not null);

-- flag:0   1 this habbit is enabled, 0 disabled
-- flag:1   1 Monday is work day, 0 Monday is rest day
-- flag:2   1 Tuesday is work day, 0 Tuesday is rest day
-- flag:3   1 Wednesday is work day, 0 Wednesday is rest day
-- flag:4   1 Thursday is work day, 0 Thursday is rest day
-- flag:5   1 Friday is work day, 0 Friday is rest day
-- flag:6   1 Saturday is work day, 0 Saturday is rest day
-- flag:7   1 Sunday is work day, 0 Sunday is rest day
create table habits (id int primary key auto_increment,
                     uid int,
                     name varchar(64),
                     flag int);
                    
