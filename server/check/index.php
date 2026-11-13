<?php
// Answers one question for the program: has this license code been switched off?
// The program sends a short name for the code, never the code itself. The list of
// switched off names is one per line in a file kept outside the web folder, and it
// holds no company names. Codes are made and checked without this server; all it
// can do is turn one off.
header('Content-Type: application/json');
header('Cache-Control: no-store');
$id = $_GET['id'] ?? '';
if (!is_string($id) || !preg_match('/^[0-9a-f]{24}$/', $id)) {
  http_response_code(400);
  exit('{"error":"id"}');
}
$file = dirname(__DIR__, 2) . '/codes-off.txt';
$off = is_file($file) && in_array($id, file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES), true);
echo json_encode(['off' => $off]);
