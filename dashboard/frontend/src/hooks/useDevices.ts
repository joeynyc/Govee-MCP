import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";
import type { Device, RgbColor } from "../api/types";

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: api.getDevices,
    refetchInterval: 30000,
  });
}

export function usePowerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      model,
      on,
    }: {
      deviceId: string;
      model: string;
      on: boolean;
    }) => api.setPower(deviceId, model, on),
    onMutate: async ({ deviceId, on }) => {
      await queryClient.cancelQueries({ queryKey: ["devices"] });
      const previous = queryClient.getQueryData<Device[]>(["devices"]);

      queryClient.setQueryData<Device[]>(["devices"], (old) =>
        old?.map((d) =>
          d.deviceId === deviceId
            ? { ...d, state: { ...d.state, power: on ? "on" : "off" } }
            : d
        )
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["devices"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useBrightnessMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      model,
      percent,
    }: {
      deviceId: string;
      model: string;
      percent: number;
    }) => api.setBrightness(deviceId, model, percent),
    onMutate: async ({ deviceId, percent }) => {
      await queryClient.cancelQueries({ queryKey: ["devices"] });
      const previous = queryClient.getQueryData<Device[]>(["devices"]);

      queryClient.setQueryData<Device[]>(["devices"], (old) =>
        old?.map((d) =>
          d.deviceId === deviceId
            ? { ...d, state: { ...d.state, brightness: percent } }
            : d
        )
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["devices"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useColorMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      model,
      color,
    }: {
      deviceId: string;
      model: string;
      color: RgbColor;
    }) => api.setColor(deviceId, model, color),
    onMutate: async ({ deviceId, color }) => {
      await queryClient.cancelQueries({ queryKey: ["devices"] });
      const previous = queryClient.getQueryData<Device[]>(["devices"]);

      queryClient.setQueryData<Device[]>(["devices"], (old) =>
        old?.map((d) =>
          d.deviceId === deviceId ? { ...d, state: { ...d.state, color } } : d
        )
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["devices"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useColorTempMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      model,
      kelvin,
    }: {
      deviceId: string;
      model: string;
      kelvin: number;
    }) => api.setColorTemp(deviceId, model, kelvin),
    onMutate: async ({ deviceId, kelvin }) => {
      await queryClient.cancelQueries({ queryKey: ["devices"] });
      const previous = queryClient.getQueryData<Device[]>(["devices"]);

      queryClient.setQueryData<Device[]>(["devices"], (old) =>
        old?.map((d) =>
          d.deviceId === deviceId
            ? { ...d, state: { ...d.state, colorTem: kelvin } }
            : d
        )
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["devices"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}
