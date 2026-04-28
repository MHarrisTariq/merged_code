resource "aws_db_subnet_group" "swyft" {
  name       = "${var.project_name}-db-subnets"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-rds-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "postgres" {
  identifier                 = "${var.project_name}-pg"
  engine                     = "postgres"
  engine_version             = "16"
  instance_class             = "db.t3.medium"
  allocated_storage          = 50
  max_allocated_storage      = 200
  storage_encrypted          = true
  multi_az                   = true
  db_name                    = "swyft"
  username                   = var.db_username
  password                   = var.db_password
  db_subnet_group_name       = aws_db_subnet_group.swyft.name
  vpc_security_group_ids     = [aws_security_group.rds.id]
  skip_final_snapshot        = true
  backup_retention_period    = 7
  auto_minor_version_upgrade = true
}
