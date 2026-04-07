Установка поддерживает операционные системы
- Linux
- Windows
- Mac OS
### Шаги установки
1. Install docker

- Для Linux:
  1. Установить докер:
     Следуйте инструкции: https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository

- Для Windows:
	  Следуйте инструкции: https://docs.docker.com/desktop/setup/install/windows-install/

- Для Mac OS:
	  Следуйте инструкции: https://docs.docker.com/desktop/setup/install/mac-install/

2. Запустить консоль в корне проекта. (Там, где лежат файлы docker-compose.yaml и .env).
3. Удостоверьтесь, что в корне проекта лежит .env файл со всеми переменными. Если его нет, обратись к авторам проекта.
4. Откройте файл .env. Помимо чувствительных данных, там также описаны порты на которых будут работать контейнеры приложения. Проверьте, что предложенные порты свободны, в противном случае измените на свободные.
5. Запустите docker engine, если он еще не запущен. Для проверки можно выполнить в консоли команду `sudo docker ps -a`. Если она вывела список контейнеров, значит docker engine запущен.

6. Проверьте, что нет контейнеров с именами `frontend`, `backend`, `postgres`, `s3`. Если они есть удалите их. Для удаления контейнеров можете воспользоваться командой `sudo docker stop <имя контейнера>`, затем `sudo docker rm <имя контейнера>`.
7. Для запуска приложения выполните в консоли команду:
	   - Linux: `sudo docker compose up -d --build`
	- Windows (PowerShell): `docker compose up -d --build`
	- Mac OS: `docker compose up -d --build`
8. Дождаться статуса всех контейнеров `Started` или `Healthy` (3-10 минут)
### Проверка что решение развёрнуто корректно

Перейти в браузере по адресу https://localhost:80
