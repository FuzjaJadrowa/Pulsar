export interface QueueBridgeEvent {
  id?: string;
  type?: string;
  success?: boolean;
  error?: string;
  filepath?: string;
  path?: string;
  output_path?: string;
  filename?: string;
  percent?: string | number;
  progress?: string | number;
  percentage?: string | number;
  eta?: string | number;
  eta_seconds?: string | number;
  stage?: string;
  status?: string;
  duration?: string | number;
  time?: string;
  speed?: string;
  item_index?: string | number;
  item_count?: string | number;
}