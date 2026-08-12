import random
import tkinter as tk
from tkinter import messagebox

WIDTH = 620
HEIGHT = 620
CELL_SIZE = 20
GRID_W = WIDTH // CELL_SIZE
GRID_H = HEIGHT // CELL_SIZE


class EnemySnake:
    def __init__(self, game):
        self.game = game
        self.body = []
        self.direction = (1, 0)
        self.color = "#fbbf24"
        self.setup()

    def setup(self):
        while True:
            x = random.randint(2, GRID_W - 3)
            y = random.randint(2, GRID_H - 3)
            start = (x, y)
            if start in self.game.body or start in self.game.poison_cells:
                continue
            self.body = [start, (x - 1, y), (x - 2, y)]
            self.direction = (1, 0)
            return

    def move(self):
        if not self.body:
            return

        head = self.body[0]
        target = self.game.food
        options = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        valid = []

        for dx, dy in options:
            nxt = (head[0] + dx, head[1] + dy)
            if nxt[0] < 0 or nxt[1] < 0 or nxt[0] >= GRID_W or nxt[1] >= GRID_H:
                continue
            if nxt in self.game.poison_cells:
                continue
            if nxt in self.body[:-1]:
                continue
            if nxt in self.game.body:
                continue
            valid.append((dx, dy))

        if not valid:
            return

        best_dir = min(
            valid,
            key=lambda d: abs((head[0] + d[0]) - target[0]) + abs((head[1] + d[1]) - target[1]),
        )
        self.direction = best_dir
        new_head = (head[0] + self.direction[0], head[1] + self.direction[1])

        self.body.insert(0, new_head)

        if new_head == self.game.food:
            self.game.food = self.game.spawn_food()
        else:
            self.body.pop()

        if self.body[0] in self.game.body:
            self.game.handle_termination()


class SnakeGame:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Snake Game")
        self.root.configure(bg="#020817")

        self.canvas = tk.Canvas(
            self.root,
            width=WIDTH,
            height=HEIGHT,
            bg="#020817",
            highlightthickness=0,
        )
        self.canvas.pack(padx=10, pady=10)

        self.root.bind("<KeyPress>", self.on_key)

        self.level = 1
        self.total_lives = 5
        self.lives = self.total_lives
        self.score = 0
        self.eaten_in_level = 0
        self.level_target = 1
        self.direction = (1, 0)
        self.body = []
        self.food = (0, 0)
        self.poison_cells = set()
        self.move_job = None
        self.game_over = False
        self.enemies = []

        self.setup_level()

    def setup_level(self):
        if self.move_job is not None:
            self.root.after_cancel(self.move_job)
            self.move_job = None

        self.level_target = self.calculate_target_for_level(self.level)
        self.poison_cells = self.build_poison_cells()

        center_x = GRID_W // 2
        center_y = GRID_H // 2
        self.direction = (1, 0)
        self.body = [
            (center_x, center_y),
            (center_x - 1, center_y),
            (center_x - 2, center_y),
        ]

        self.enemies = []
        if self.level % 5 == 0:
            for _ in range(2):
                self.enemies.append(EnemySnake(self))

        self.food = self.spawn_food()
        self.eaten_in_level = 0
        self.speed = self.get_speed_for_level(self.level)
        self.update_title()
        self.draw()
        self.move_job = self.root.after(self.speed, self.advance)

    def calculate_target_for_level(self, level):
        if level <= 1:
            return 1
        return 2 ** (level - 1)

    def build_poison_cells(self):
        poison = set()
        for x in range(GRID_W):
            poison.add((x, 0))
            poison.add((x, GRID_H - 1))
        for y in range(GRID_H):
            poison.add((0, y))
            poison.add((GRID_W - 1, y))
        return poison

    def get_speed_for_level(self, level):
        if level % 5 == 0:
            return max(45, 170 - (level * 10))
        return max(70, 180 - (level * 7))

    def update_title(self):
        heart_text = "♥ " * self.lives
        level_label = "HARD" if self.level % 5 == 0 else "NORMAL"
        self.root.title(
            f"Level {self.level} | {level_label} | Target {self.level_target} | Eaten {self.eaten_in_level} | Lives {heart_text}"
        )

    def spawn_food(self):
        while True:
            x = random.randint(1, GRID_W - 2)
            y = random.randint(1, GRID_H - 2)
            pos = (x, y)
            if pos in self.body or pos in self.poison_cells:
                continue
            if any(pos in enemy.body for enemy in self.enemies):
                continue
            return pos

    def on_key(self, event):
        key = event.keysym.lower()
        moves = {
            "up": (0, -1),
            "down": (0, 1),
            "left": (-1, 0),
            "right": (1, 0),
        }

        if key not in moves:
            return

        new_dir = moves[key]
        if self.body and (
            new_dir[0] == -self.direction[0] and new_dir[1] == -self.direction[1]
        ):
            return

        self.direction = new_dir

    def advance(self):
        if self.game_over:
            return

        head_x, head_y = self.body[0]
        dx, dy = self.direction
        new_head = (head_x + dx, head_y + dy)

        if (
            new_head[0] < 0
            or new_head[1] < 0
            or new_head[0] >= GRID_W
            or new_head[1] >= GRID_H
            or new_head in self.poison_cells
            or new_head in self.body[:-1]
        ):
            self.handle_termination()
            return

        self.body.insert(0, new_head)

        if new_head == self.food:
            self.eaten_in_level += 1
            self.score += 1
            self.food = self.spawn_food()
            if self.eaten_in_level >= self.level_target:
                self.level += 1
                self.lives = self.total_lives
                self.root.after(300, self.setup_level)
                return
        else:
            self.body.pop()

        if self.level % 5 == 0:
            for enemy in self.enemies:
                enemy.move()
                if self.body[0] in enemy.body or enemy.body[0] in self.body:
                    self.handle_termination()
                    return

        self.update_title()
        self.draw()
        self.move_job = self.root.after(self.speed, self.advance)

    def handle_termination(self):
        self.lives -= 1
        self.draw()

        if self.lives <= 0:
            self.game_over = True
            self.canvas.delete("all")
            self.canvas.create_text(
                WIDTH // 2,
                HEIGHT // 2,
                text="SNAKE TERMINATED\nALL LIVES USED",
                fill="#f87171",
                font=("Arial", 24, "bold"),
                justify="center",
            )
            self.root.title("Snake Game - Final Score: " + str(self.score))
            answer = messagebox.askyesno(
                "Game Over",
                "Restart current level?",
            )
            if answer:
                self.game_over = False
                self.lives = self.total_lives
                self.setup_level()
            else:
                self.root.destroy()
            return

        self.canvas.delete("all")
        self.canvas.create_text(
            WIDTH // 2,
            HEIGHT // 2,
            text="SNAKE TERMINATED",
            fill="#fca5a5",
            font=("Arial", 26, "bold"),
            justify="center",
        )
        self.canvas.create_text(
            WIDTH // 2,
            HEIGHT // 2 + 40,
            text=f"Lives left: {self.lives}",
            fill="#fef3c7",
            font=("Arial", 16, "bold"),
        )
        self.root.after(700, self.setup_level)

    def draw(self):
        self.canvas.delete("all")

        for x in range(GRID_W):
            for y in range(GRID_H):
                self.canvas.create_rectangle(
                    x * CELL_SIZE,
                    y * CELL_SIZE,
                    x * CELL_SIZE + CELL_SIZE,
                    y * CELL_SIZE + CELL_SIZE,
                    fill="#0f172a",
                    outline="#111827",
                    width=1,
                )

        for cell in self.poison_cells:
            x, y = cell
            self.canvas.create_rectangle(
                x * CELL_SIZE + 2,
                y * CELL_SIZE + 2,
                x * CELL_SIZE + CELL_SIZE - 2,
                y * CELL_SIZE + CELL_SIZE - 2,
                fill="#7c3aed",
                outline="#4c1d95",
                width=1,
            )

        if self.level % 5 == 0:
            self.canvas.create_text(
                WIDTH / 2,
                18,
                text="HARD LEVEL",
                fill="#fbbf24",
                font=("Arial", 15, "bold"),
            )

        fx, fy = self.food
        self.canvas.create_oval(
            fx * CELL_SIZE + 4,
            fy * CELL_SIZE + 4,
            fx * CELL_SIZE + CELL_SIZE - 4,
            fy * CELL_SIZE + CELL_SIZE - 4,
            fill="#f43f5e",
            outline="#be123c",
            width=2,
        )

        for index, (x, y) in enumerate(self.body):
            px = x * CELL_SIZE
            py = y * CELL_SIZE
            fill = "#22c55e" if index == 0 else "#4ade80"
            outline = "#15803d" if index == 0 else "#166534"
            self.canvas.create_rectangle(
                px + 2,
                py + 2,
                px + CELL_SIZE - 2,
                py + CELL_SIZE - 2,
                fill=fill,
                outline=outline,
                width=2,
            )

        for enemy in self.enemies:
            for index, (x, y) in enumerate(enemy.body):
                px = x * CELL_SIZE
                py = y * CELL_SIZE
                fill = "#f59e0b" if index == 0 else "#fbbf24"
                outline = "#d97706" if index == 0 else "#f59e0b"
                self.canvas.create_rectangle(
                    px + 2,
                    py + 2,
                    px + CELL_SIZE - 2,
                    py + CELL_SIZE - 2,
                    fill=fill,
                    outline=outline,
                    width=2,
                )

        self.canvas.create_text(
            18,
            10,
            text=f"Level {self.level}",
            fill="#e2e8f0",
            anchor="w",
            font=("Arial", 12, "bold"),
        )
        self.canvas.create_text(
            WIDTH - 18,
            10,
            text=f"Target {self.level_target}",
            fill="#e2e8f0",
            anchor="e",
            font=("Arial", 12, "bold"),
        )

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    game = SnakeGame()
    game.run()
